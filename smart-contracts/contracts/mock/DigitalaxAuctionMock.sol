pragma solidity 0.6.12;

import "../DigitalaxAuction.sol";

contract DigitalaxAuctionMock is DigitalaxAuction {
    uint256 public nowOverride;

    constructor(
        DigitalaxAccessControls _accessControls,
        DigitalaxGarmentNFT _garmentNft
    )
    DigitalaxAuction(_accessControls, _garmentNft)
    public {}

    function setNowOverride(uint256 _now) external {
        nowOverride = _now;
    }

    function _getNow() internal override view returns (uint256) {
        return nowOverride;
    }
}
