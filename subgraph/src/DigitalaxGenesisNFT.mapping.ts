import {log, BigInt} from "@graphprotocol/graph-ts/index";

import {
    ContributionIncreased,
    GenesisPurchased,
    DigitalaxGenesisNFTContractDeployed,
    DigitalaxGenesisNFT as DigitalaxGenesisNFTContract
} from "../generated/DigitalaxGenesisNFT/DigitalaxGenesisNFT";

import {
    GenesisContributor,
    DigitalaxGenesis
} from "../generated/schema";

export function handleGenesisPurchased(event: GenesisPurchased): void {
    log.info('handleGenesisPurchased() @ hash: {}', [event.transaction.hash.toHexString()])

    //     event GenesisPurchased(
    //         address indexed buyer,
    //         uint256 contribution
    //     );

    let genesisContributor = new GenesisContributor(event.params.buyer.toHexString())
    genesisContributor.contributor = event.params.buyer
    genesisContributor.firstContributedTimestamp = event.block.timestamp
    genesisContributor.totalContribtuionInWei = event.params.contribution
    genesisContributor.lastContributedTimestamp = event.block.timestamp

    genesisContributor.save()

    // update contract info
    let digitalaxGenesis = DigitalaxGenesis.load(event.address.toHexString());
    digitalaxGenesis.totalContributions = DigitalaxGenesisNFTContract.bind(event.address).totalContributions();
    digitalaxGenesis.save();
}

export function handleContributionIncreased(event: ContributionIncreased): void {
    log.info('handleContributionIncreased() @ hash: {}', [event.transaction.hash.toHexString()])

    //     event ContributionIncreased(
    //         address indexed buyer,
    //         uint256 increasedContribution,
    //         uint256 buyerTotalContribution
    //     );

    let genesisContributor: GenesisContributor | null = GenesisContributor.load(event.params.buyer.toHexString())
    genesisContributor.totalContribtuionInWei = genesisContributor.totalContribtuionInWei.plus(event.params.contribution)
    genesisContributor.lastContributedTimestamp = event.block.timestamp
    genesisContributor.save()

    // update contract info
    let digitalaxGenesis = DigitalaxGenesis.load(event.address.toHexString());
    digitalaxGenesis.totalContributions = DigitalaxGenesisNFTContract.bind(event.address).totalContributions();
    digitalaxGenesis.save();
}

export function handleGenesisDeployed(event: DigitalaxGenesisNFTContractDeployed): void {
    log.info('handleGenesisDeployed() @ hash: {}', [event.transaction.hash.toHexString()])

    let contract = DigitalaxGenesisNFTContract.bind(event.address);

    let digitalaxGenesis = new DigitalaxGenesis(event.address.toHexString());
    digitalaxGenesis.accessControls = contract.accessControls();
    digitalaxGenesis.fundsMultisig = contract.fundsMultisig();
    digitalaxGenesis.genesisStart = contract.genesisStartTimestamp();
    digitalaxGenesis.genesisEnd = contract.genesisEndTimestamp();
    digitalaxGenesis.minimumContributionAmount = contract.minimumContributionAmount();
    digitalaxGenesis.maximumContributionAmount = contract.maximumContributionAmount();
    digitalaxGenesis.totalContributions = contract.totalContributions();
    digitalaxGenesis.save();
}
