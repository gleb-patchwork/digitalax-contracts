const {
  expectRevert,
  expectEvent,
  BN,
  ether,
  constants,
  balance
} = require('@openzeppelin/test-helpers');

const {expect} = require('chai');

const DigitalaxAccessControls = artifacts.require('DigitalaxAccessControls');
const DigitalaxGarmentNFT = artifacts.require('DigitalaxGarmentNFT');
const DigitalaxAuction = artifacts.require('DigitalaxAuctionMock');

contract('DigitalaxAuction', (accounts) => {
  const [admin, minter, owner, designer, bidder, bidder2] = accounts;

  const TOKEN_ONE_ID = new BN('1');

  const randomTokenURI = 'rand';

  beforeEach(async () => {
    this.accessControls = await DigitalaxAccessControls.new({from: admin});
    await this.accessControls.addMinterRole(minter, {from: admin});

    this.token = await DigitalaxGarmentNFT.new(this.accessControls.address, {from: admin});
    this.auction = await DigitalaxAuction.new(
      this.accessControls.address,
      this.token.address,
      {from: admin}
    );

    await this.accessControls.addSmartContractRole(this.auction.address, {from: admin});
  });

  describe('Admin functions', () => {
    beforeEach(async () => {
      await this.token.mint(minter, randomTokenURI, designer, {from: minter});
      await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
      await this.auction.setNowOverride('2');
      await this.auction.createAuction(
        TOKEN_ONE_ID,
        '1',
        '0',
        '10',
        {from: minter}
      );
      await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});
    });

    describe('Auction resulting', () => {
      it('Successfully results the auction', async () => {
        await this.auction.setNowOverride('12');

        const {receipt} = await this.auction.resultAuction(TOKEN_ONE_ID, {from: admin});

        await expectEvent(receipt, 'AuctionResulted', {
          garmentTokenId: TOKEN_ONE_ID,
          winner: bidder,
          winningBid: ether('0.2')
        });

        const {_bidder, _bid} = await this.auction.getHighestBidder(TOKEN_ONE_ID);
        expect(_bid).to.be.bignumber.equal('0');
        expect(_bidder).to.equal(constants.ZERO_ADDRESS);

        const {_reservePrice, _startTime, _endTime, _lister, _resulted} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(_reservePrice).to.be.bignumber.equal('1');
        expect(_startTime).to.be.bignumber.equal('0');
        expect(_endTime).to.be.bignumber.equal('10');
        expect(_lister).to.be.equal(minter);
        expect(_resulted).to.be.equal(true);
      });
    });

    describe('updateMinBidIncrement()', () => {
      it('fails when not admin', async () => {
        await expectRevert(
          this.auction.updateMinBidIncrement('1', {from: bidder}),
          'DigitalaxAuction.updateMinBidIncrement: Sender must be admin'
        );
      });
      it('successfully updates min bid', async () => {
        const original = await this.auction.minBidIncrement();
        expect(original).to.be.bignumber.equal(ether('0.1'));

        await this.auction.updateMinBidIncrement(ether('0.2'), {from: admin});

        const updated = await this.auction.minBidIncrement();
        expect(updated).to.be.bignumber.equal(ether('0.2'));
      });
    });

    describe('updateAuctionReservePrice()', () => {
      it('fails when not admin', async () => {
        await expectRevert(
          this.auction.updateAuctionReservePrice(TOKEN_ONE_ID, '1', {from: bidder}),
          'DigitalaxAuction.updateAuctionReservePrice: Sender must be admin'
        );
      });
      it('successfully updates auction reserve', async () => {
        let {_reservePrice} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(_reservePrice).to.be.bignumber.equal('1');

        await this.auction.updateAuctionReservePrice(TOKEN_ONE_ID, '2', {from: admin});

        let {_reservePrice: updateReservePrice} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(updateReservePrice).to.be.bignumber.equal('2');
      });
    });

    describe('updateAuctionStartTime()', () => {
      it('fails when not admin', async () => {
        await expectRevert(
          this.auction.updateAuctionStartTime(TOKEN_ONE_ID, '1', {from: bidder}),
          'DigitalaxAuction.updateAuctionStartTime: Sender must be admin'
        );
      });
      it('successfully updates auction start time', async () => {
        let {_startTime} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(_startTime).to.be.bignumber.equal('0');

        await this.auction.updateAuctionStartTime(TOKEN_ONE_ID, '2', {from: admin});

        let {_startTime: updated} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(updated).to.be.bignumber.equal('2');
      });
    });

    describe('updateAuctionEndTime()', () => {
      it('fails when not admin', async () => {
        await expectRevert(
          this.auction.updateAuctionEndTime(TOKEN_ONE_ID, '1', {from: bidder}),
          'DigitalaxAuction.updateAuctionEndTime: Sender must be admin'
        );
      });
      it('successfully updates auction end time', async () => {
        let {_endTime} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(_endTime).to.be.bignumber.equal('10');

        await this.auction.updateAuctionEndTime(TOKEN_ONE_ID, '20', {from: admin});

        let {_endTime: updated} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(updated).to.be.bignumber.equal('20');
      });
    });

    describe('updateAccessControls()', () => {
      it('fails when not admin', async () => {
        await expectRevert(
          this.auction.updateAccessControls(this.accessControls.address, {from: bidder}),
          'DigitalaxAuction.updateAccessControls: Sender must be admin'
        );
      });
      it('successfully updates access controls', async () => {
        const accessControlsV2 = await DigitalaxAccessControls.new({from: admin});

        const original = await this.auction.accessControls();
        expect(original).to.be.equal(this.accessControls.address);

        await this.auction.updateAccessControls(accessControlsV2.address, {from: admin});

        const updated = await this.auction.accessControls();
        expect(updated).to.be.equal(accessControlsV2.address);
      });
    });
  });

  describe('createAuction()', async () => {

    describe('validation', async () => {
      it('fails if does not have minter role', async () => {
        await expectRevert(
          this.auction.createAuction(TOKEN_ONE_ID, '1', '0', '10', {from: bidder}),
          'DigitalaxAuction.createAuction: Sender must have the minter role'
        );
      });

      it('fails if endTime greater than startTime', async () => {
        await this.auction.setNowOverride('2');
        await expectRevert(
          this.auction.createAuction(TOKEN_ONE_ID, '1', '1', '0', {from: minter}),
          'DigitalaxAuction.createAuction: End time must be greater than start'
        );
      });

      it('fails if token already has auction in play', async () => {
        await this.auction.setNowOverride('2');
        await this.token.mint(minter, randomTokenURI, designer, {from: minter});
        await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
        await this.auction.createAuction(TOKEN_ONE_ID, '1', '0', '10', {from: minter});

        await expectRevert(
          this.auction.createAuction(TOKEN_ONE_ID, '1', '1', '3', {from: minter}),
          'DigitalaxAuction.createAuction: Cannot create an auction in the middle of another'
        );
      });

      it('fails if token does not exist', async () => {
        await this.auction.setNowOverride('10');

        await expectRevert(
          this.auction.createAuction(TOKEN_ONE_ID, '1', '1', '3', {from: minter}),
          'ERC721: operator query for nonexistent token'
        );
      });
    });

    describe('successful creation', async () => {
      it('Token transferred to the auction', async () => {
        await this.auction.setNowOverride('2');
        await this.token.mint(minter, randomTokenURI, designer, {from: minter});
        await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
        await this.auction.createAuction(TOKEN_ONE_ID, '1', '0', '10', {from: minter});

        const owner = await this.token.ownerOf(TOKEN_ONE_ID);
        expect(owner).to.be.equal(this.auction.address);
      });
    });

  });

  describe('placeBid()', async () => {

    describe('validation', () => {

      beforeEach(async () => {
        await this.token.mint(minter, randomTokenURI, designer, {from: minter});
        await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
        await this.auction.setNowOverride('2');
        await this.auction.createAuction(
          TOKEN_ONE_ID, // ID
          '1',  // reserve
          '1', // start
          '10', // end
          {from: minter}
        );
      });

      it('will fail with 721 token not on auction', async () => {
        await expectRevert(
          this.auction.placeBid(999, {from: bidder, value: 1}),
          'DigitalaxAuction.placeBid: Auction does not exist'
        );
      });

      it('will fail when auction not started', async () => {
        await this.auction.setNowOverride('0');
        await expectRevert(
          this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: 1}),
          'DigitalaxAuction.placeBid: Bidding outside of the auction window'
        );
      });

      it('will fail when auction finished', async () => {
        await this.auction.setNowOverride('11');
        await expectRevert(
          this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: 1}),
          'DigitalaxAuction.placeBid: Bidding outside of the auction window'
        );
      });

      it('will fail when outbidding someone by less than the increment', async () => {
        await this.auction.setNowOverride('2');
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});

        await expectRevert(
          this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')}),
          'DigitalaxAuction.placeBid: Failed to outbid highest bidder'
        );
      });
    });

    describe('successfully places bid', () => {

      beforeEach(async () => {
        await this.token.mint(minter, randomTokenURI, designer, {from: minter});
        await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
        await this.auction.setNowOverride('1');
        await this.auction.createAuction(
          TOKEN_ONE_ID, // ID
          '1',  // reserve
          '1', // start
          '10', // end
          {from: minter}
        );
      });

      it('places bid and you are the top owner', async () => {
        await this.auction.setNowOverride('2');
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});

        const {_bidder, _bid} = await this.auction.getHighestBidder(TOKEN_ONE_ID);
        expect(_bid).to.be.bignumber.equal(ether('0.2'));
        expect(_bidder).to.equal(bidder);

        const {_reservePrice, _startTime, _endTime, _lister, _resulted} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(_reservePrice).to.be.bignumber.equal('1');
        expect(_startTime).to.be.bignumber.equal('1');
        expect(_endTime).to.be.bignumber.equal('10');
        expect(_lister).to.be.equal(minter);
        expect(_resulted).to.be.equal(false);
      });

      it('will refund the top bidder if found', async () => {
        await this.auction.setNowOverride('2');
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});

        const {_bidder: originalBidder, _bid: originalBid} = await this.auction.getHighestBidder(TOKEN_ONE_ID);
        expect(originalBid).to.be.bignumber.equal(ether('0.2'));
        expect(originalBidder).to.equal(bidder);

        const bidderTracker = await balance.tracker(bidder);

        // make a new bid, out bidding the previous bidder
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder2, value: ether('0.4')});

        // Funds sent back to original bidder
        const changes = await bidderTracker.delta('wei');
        expect(changes).to.be.bignumber.equal(ether('0.2'));

        const {_bidder, _bid} = await this.auction.getHighestBidder(TOKEN_ONE_ID);
        expect(_bid).to.be.bignumber.equal(ether('0.4'));
        expect(_bidder).to.equal(bidder2);
      });
    });

  });

  describe('withdrawBid()', async () => {

    beforeEach(async () => {
      await this.token.mint(minter, randomTokenURI, designer, {from: minter});
      await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
      await this.auction.setNowOverride('2');
      await this.auction.createAuction(
        TOKEN_ONE_ID,
        '1',
        '0',
        '10',
        {from: minter}
      );
      await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});
    });

    it('fails with withdrawing a bid which does not exist', async () => {
      await expectRevert(
        this.auction.withdrawBid(999, {from: bidder2}),
        'DigitalaxAuction.withdrawBid: You are not the highest bidder'
      );
    });

    it('fails with withdrawing a bid which you did not make', async () => {
      await expectRevert(
        this.auction.withdrawBid(TOKEN_ONE_ID, {from: bidder2}),
        'DigitalaxAuction.withdrawBid: You are not the highest bidder'
      );
    });

    it('successfully withdraw the bid', async () => {
      const {_bidder: originalBidder, _bid: originalBid} = await this.auction.getHighestBidder(TOKEN_ONE_ID);
      expect(originalBid).to.be.bignumber.equal(ether('0.2'));
      expect(originalBidder).to.equal(bidder);

      const bidderTracker = await balance.tracker(bidder);

      const receipt = await this.auction.withdrawBid(TOKEN_ONE_ID, {from: bidder});

      // Funds sent back to original bidder, minus GAS costs
      const changes = await bidderTracker.delta('wei');
      expect(changes).to.be.bignumber.equal(
        ether('0.2').sub(await getGasCosts(receipt))
      );

      const {_bidder, _bid} = await this.auction.getHighestBidder(TOKEN_ONE_ID);
      expect(_bid).to.be.bignumber.equal('0');
      expect(_bidder).to.equal(constants.ZERO_ADDRESS);
    });
  });

  describe('resultAuction()', async () => {

    describe('validation', () => {

      beforeEach(async () => {
        await this.token.mint(minter, randomTokenURI, designer, {from: minter});
        await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
        await this.auction.setNowOverride('2');
        await this.auction.createAuction(
          TOKEN_ONE_ID,
          '1',
          '0',
          '10',
          {from: minter}
        );
      });

      it('cannot result if not an admin', async () => {
        await expectRevert(
          this.auction.resultAuction(TOKEN_ONE_ID, {from: bidder}),
          'DigitalaxAuction.resultAuction: Sender must be admin'
        );
      });

      it('cannot result if auction has not ended', async () => {
        await expectRevert(
          this.auction.resultAuction(TOKEN_ONE_ID, {from: admin}),
          'DigitalaxAuction.resultAuction: The auction has not ended'
        );
      });

      it('cannot result if auction does not exist', async () => {
        await expectRevert(
          this.auction.resultAuction(9999, {from: admin}),
          'DigitalaxAuction.resultAuction: Auction does not exist'
        );
      });

      it('cannot result if the auction has no winner', async () => {
        await this.auction.setNowOverride('12');
        await expectRevert(
          this.auction.resultAuction(TOKEN_ONE_ID, {from: admin}),
          'DigitalaxAuction.resultAuction: No one has bid'
        );
      });

      it('cannot result if the auction if its already resulted', async () => {
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});
        await this.auction.setNowOverride('12');

        // result it
        await this.auction.resultAuction(TOKEN_ONE_ID, {from: admin});

        // try result it again
        await expectRevert(
          this.auction.resultAuction(TOKEN_ONE_ID, {from: admin}),
          'DigitalaxAuction.resultAuction: auction already resulted'
        );
      });
    });

    describe('successfully resulting an auction', async () => {

      beforeEach(async () => {
        await this.token.mint(minter, randomTokenURI, designer, {from: minter});
        await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
        await this.auction.setNowOverride('2');
        await this.auction.createAuction(
          TOKEN_ONE_ID,
          '1',
          '0',
          '10',
          {from: minter}
        );
      });

      it('transfer token to the winner', async () => {
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});
        await this.auction.setNowOverride('12');

        expect(await this.token.ownerOf(TOKEN_ONE_ID)).to.be.equal(this.auction.address);

        await this.auction.resultAuction(TOKEN_ONE_ID, {from: admin});

        expect(await this.token.ownerOf(TOKEN_ONE_ID)).to.be.equal(bidder);
      });

      it('transfer funds to the token owner creator', async () => {
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.4')});
        await this.auction.setNowOverride('12');

        const designerTracker = await balance.tracker(designer);

        // Result it successfully
        await this.auction.resultAuction(TOKEN_ONE_ID, {from: admin});

        // Funds sent to designer on completion
        const changes = await designerTracker.delta('wei');
        expect(changes).to.be.bignumber.equal(ether('0.4'));
      });

      it('records primary sale price on garment NFT', async () => {
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.4')});
        await this.auction.setNowOverride('12');

        // Result it successfully
        await this.auction.resultAuction(TOKEN_ONE_ID, {from: admin});

        const primarySalePrice = await this.token.primarySalePrice(TOKEN_ONE_ID);
        expect(primarySalePrice).to.be.bignumber.equal(ether('0.4'));
      });

    });

  });

  describe('cancelAuction()', async () => {

    beforeEach(async () => {
      await this.token.mint(minter, randomTokenURI, designer, {from: minter});
      await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
      await this.auction.setNowOverride('2');
      await this.auction.createAuction(
        TOKEN_ONE_ID,
        '1',
        '0',
        '10',
        {from: minter}
      );
    });

    describe('validation', async () => {

      it('cannot cancel if not an admin', async () => {
        await expectRevert(
          this.auction.cancelAuction(TOKEN_ONE_ID, {from: bidder}),
          'DigitalaxAuction.cancelAuction: Sender must be admin'
        );
      });

      it('cannot cancel if auction already cancelled', async () => {
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});
        await this.auction.setNowOverride('12');

        await this.auction.cancelAuction(TOKEN_ONE_ID, {from: admin});

        await expectRevert(
          this.auction.cancelAuction(TOKEN_ONE_ID, {from: admin}),
          'DigitalaxAuction.cancelAuction: Auction does not exist'
        );
      });

      it('cannot cancel if auction already resulted', async () => {
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});
        await this.auction.setNowOverride('12');

        await this.auction.resultAuction(TOKEN_ONE_ID, {from: admin});

        await expectRevert(
          this.auction.cancelAuction(TOKEN_ONE_ID, {from: admin}),
          'DigitalaxAuction.cancelAuction: auction already resulted'
        );
      });

      it('cannot cancel if auction does not exist', async () => {
        await expectRevert(
          this.auction.cancelAuction(9999, {from: admin}),
          'DigitalaxAuction.cancelAuction: Auction does not exist'
        );
      });

      it('Cancel clears down auctions and top bidder', async () => {
        // Stick a bid on it
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});

        // Cancel it
        await this.auction.cancelAuction(TOKEN_ONE_ID, {from: admin});

        // Check auction cleaned up
        const {_reservePrice, _startTime, _endTime, _lister, _resulted} = await this.auction.getAuction(TOKEN_ONE_ID);
        expect(_reservePrice).to.be.bignumber.equal('0');
        expect(_startTime).to.be.bignumber.equal('0');
        expect(_endTime).to.be.bignumber.equal('0');
        expect(_lister).to.be.equal(constants.ZERO_ADDRESS);
        expect(_resulted).to.be.equal(false);

        // Check auction cleaned up
        const {_bidder, _bid} = await this.auction.getHighestBidder(TOKEN_ONE_ID);
        expect(_bid).to.be.bignumber.equal('0');
        expect(_bidder).to.equal(constants.ZERO_ADDRESS);
      });

      it('funds are sent back to the highest bidder if found', async () => {
        // Stick a bid on it
        await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});

        const bidderTracker = await balance.tracker(bidder);

        //cancel it
        await this.auction.cancelAuction(TOKEN_ONE_ID, {from: admin});

        // Funds sent back
        const changes = await bidderTracker.delta('wei');
        expect(changes).to.be.bignumber.equal(ether('0.2'));
      });
    });

  });

  describe('create, cancel and re-create an auction', async () => {

    beforeEach(async () => {
      await this.token.mint(minter, randomTokenURI, designer, {from: minter});
      await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
      await this.auction.setNowOverride('2');
      await this.auction.createAuction(
        TOKEN_ONE_ID, // ID
        '1',  // reserve
        '1', // start
        '10', // end
        {from: minter}
      );
    });

    it('once created and then cancelled, can be created and resulted properly', async () => {

      // Stick a bid on it
      await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});

      const bidderTracker = await balance.tracker(bidder);

      // Cancel it
      await this.auction.cancelAuction(TOKEN_ONE_ID, {from: admin});

      // Funds sent back to bidder
      const changes = await bidderTracker.delta('wei');
      expect(changes).to.be.bignumber.equal(ether('0.2'));

      // Check auction cleaned up
      const {_reservePrice, _startTime, _endTime, _lister, _resulted} = await this.auction.getAuction(TOKEN_ONE_ID);
      expect(_reservePrice).to.be.bignumber.equal('0');
      expect(_startTime).to.be.bignumber.equal('0');
      expect(_endTime).to.be.bignumber.equal('0');
      expect(_lister).to.be.equal(constants.ZERO_ADDRESS);
      expect(_resulted).to.be.equal(false);

      // Crate new one
      await this.token.approve(this.auction.address, TOKEN_ONE_ID, {from: minter});
      await this.auction.createAuction(
        TOKEN_ONE_ID, // ID
        '1',  // reserve
        '1', // start
        '10', // end
        {from: minter}
      );

      // Check auction newly setup
      const {
        _reservePrice: newReservePrice,
        _startTime: newStartTime,
        _endTime: newEndTime,
        _lister: newLister,
        _resulted: newResulted
      } = await this.auction.getAuction(TOKEN_ONE_ID);
      expect(newReservePrice).to.be.bignumber.equal('1');
      expect(newStartTime).to.be.bignumber.equal('1');
      expect(newEndTime).to.be.bignumber.equal('10');
      expect(newLister).to.be.equal(minter);
      expect(newResulted).to.be.equal(false);

      // Stick a bid on it
      await this.auction.placeBid(TOKEN_ONE_ID, {from: bidder, value: ether('0.2')});

      await this.auction.setNowOverride('12');

      // Result it
      const {receipt} = await this.auction.resultAuction(TOKEN_ONE_ID, {from: admin});
      await expectEvent(receipt, 'AuctionResulted', {
        garmentTokenId: TOKEN_ONE_ID,
        winner: bidder,
        winningBid: ether('0.2')
      });
    });

  });

  async function getGasCosts(receipt) {
    const tx = await web3.eth.getTransaction(receipt.tx);
    const gasPrice = new BN(tx.gasPrice);
    return gasPrice.mul(new BN(receipt.receipt.gasUsed));
  }
});
