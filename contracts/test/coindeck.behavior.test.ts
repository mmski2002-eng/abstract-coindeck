import { expect } from "chai";
import { ethers } from "hardhat";

const ZERO_HASH = ethers.keccak256("0x");

function actionPayload(types: string[], values: unknown[]) {
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(types, values));
}

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  if (!block) throw new Error("Не удалось получить latest block.");
  return block.timestamp;
}

async function deployCore() {
  const [owner, admin, player, buyer, recipient, stranger] = await ethers.getSigners();

  const AdminControl = await ethers.getContractFactory("AdminControl");
  const adminControl = await AdminControl.deploy(owner.address);
  await adminControl.waitForDeployment();

  const CoinDeckNFT = await ethers.getContractFactory("CoinDeckNFT");
  const nft = await CoinDeckNFT.deploy(await adminControl.getAddress());
  await nft.waitForDeployment();

  const Tournament = await ethers.getContractFactory("Tournament");
  const tournament = await Tournament.deploy(await adminControl.getAddress(), await nft.getAddress());
  await tournament.waitForDeployment();

  const Oracle = await ethers.getContractFactory("Oracle");
  const oracle = await Oracle.deploy(await adminControl.getAddress());
  await oracle.waitForDeployment();

  const Claim = await ethers.getContractFactory("Claim");
  const claim = await Claim.deploy(await adminControl.getAddress());
  await claim.waitForDeployment();

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(await adminControl.getAddress(), await nft.getAddress());
  await marketplace.waitForDeployment();

  await adminControl.setRegisteredTournament(await tournament.getAddress());
  for (const caller of [nft, tournament, oracle, claim, marketplace]) {
    await adminControl.setAuthorizedCaller(await caller.getAddress(), true);
  }
  await nft.setTournamentContract(await tournament.getAddress());

  return { owner, admin, player, buyer, recipient, stranger, adminControl, nft, tournament, oracle, claim, marketplace };
}

async function makeFastAdminActions(adminControl: any) {
  await adminControl.setActionDelay(await adminControl.ACTION_SET_BASE_URIS(), 0);
  await adminControl.setActionDelay(await adminControl.ACTION_SET_EGG_PRICES(), 0);
  await adminControl.setActionDelay(await adminControl.ACTION_ADMIN_MINT_TO(), 0);
  await adminControl.setActionDelay(await adminControl.ACTION_RESET_ALL_ORACLE_DAYS(), 0);
  await adminControl.setActionDelay(await adminControl.ACTION_SET_CLAIM_DAYS(), 0);
  await adminControl.setActionDelay(await adminControl.ACTION_SET_CLAIM_LIST(), 0);
  await adminControl.setActionDelay(await adminControl.ACTION_START_CLAIM(), 0);
  await adminControl.setActionDelay(await adminControl.ACTION_CLOSE_CLAIM(), 0);
}

async function mintEggMonets(nft: any, to: string, playerId: number, tier: number, count: number) {
  await nft.adminMintEggMonet(to, playerId, tier, count);
  return nft.getUserEggMonets(to);
}

describe("CoinDeck контракты: безопасность и игровой поток", function () {
  it("AdminControl управляет ролями, таймлоком и лимитами вывода", async function () {
    const { admin, player, adminControl } = await deployCore();

    const treasuryRole = await adminControl.ROLE_TREASURY();
    const withdrawAction = await adminControl.ACTION_TREASURY_WITHDRAW();
    const payload = actionPayload(["address", "uint256"], [player.address, ethers.parseEther("1")]);

    await expect(adminControl.connect(admin).queueAction(withdrawAction, payload))
      .to.be.revertedWithCustomError(adminControl, "Unauthorized");

    await expect(adminControl.grantRole(admin.address, treasuryRole))
      .to.emit(adminControl, "RoleGranted")
      .withArgs(admin.address, treasuryRole);

    await adminControl.connect(admin).queueAction(withdrawAction, payload);
    await adminControl.connect(admin).queueAction(withdrawAction, payload);
    const pending = await adminControl.getPendingActions();
    expect(pending[0]).to.have.length(1);

    await expect(adminControl.consumeAction(withdrawAction, payload))
      .to.be.revertedWithCustomError(adminControl, "ActionNotReady");

    await increaseTime(3601);
    await expect(adminControl.consumeAction(withdrawAction, payload))
      .to.emit(adminControl, "ActionExecuted")
      .withArgs(withdrawAction, payload);

    await expect(adminControl.setActionDelay(withdrawAction, 0))
      .to.be.revertedWithCustomError(adminControl, "TreasuryDelayTooShort");

    await adminControl.setWithdrawalPolicy(true, ethers.parseEther("1"), ethers.parseEther("2"));
    await expect(adminControl.checkWithdrawal(ethers.parseEther("1.5")))
      .to.be.revertedWithCustomError(adminControl, "WithdrawOverPerTxLimit");

    await adminControl.setWithdrawalPolicy(true, ethers.parseEther("2"), ethers.parseEther("2"));
    await adminControl.checkWithdrawal(ethers.parseEther("1"));
    await expect(adminControl.checkWithdrawal(ethers.parseEther("1.1")))
      .to.be.revertedWithCustomError(adminControl, "WithdrawOverDailyLimit");
  });

  it("Oracle публикует день один раз и сбрасывает данные только через admin action", async function () {
    const { adminControl, oracle } = await deployCore();
    await makeFastAdminActions(adminControl);

    await expect(oracle.postDayScores(1, [0, 1, 2], [100, 200, 300]))
      .to.emit(oracle, "ScoresPosted")
      .withArgs(await adminControl.owner(), 1, 3);

    await expect(oracle.postDayScores(1, [0], [100]))
      .to.be.revertedWithCustomError(oracle, "DayAlreadyPosted");

    await expect(oracle.postDayScores(2, [0], [10001]))
      .to.be.revertedWithCustomError(oracle, "ScoreTooHigh");

    await oracle.resetAllDays([1]);
    const scores = await oracle.getDayScores(1);
    expect(scores[0]).to.deep.equal([]);
    expect(scores[1]).to.deep.equal([]);
    expect(scores[2]).to.equal(false);
  });

  it("Claim открывает окно выплат, не дает повторный claim и возвращает остаток после дедлайна", async function () {
    const { player, buyer, recipient, adminControl, claim } = await deployCore();
    await makeFastAdminActions(adminControl);

    const playerPrize = ethers.parseEther("0.2");
    const buyerPrize = ethers.parseEther("0.1");

    await claim.setClaimDays(1);
    await claim.setClaimList([player.address, buyer.address], [playerPrize, buyerPrize]);
    await ethers.provider.send("hardhat_setBalance", [await claim.getAddress(), "0x56bc75e2d63100000"]);

    await expect(claim.startClaim(recipient.address))
      .to.emit(claim, "ClaimOpened");

    expect(await claim.getClaimable(player.address)).to.equal(playerPrize);
    await expect(claim.connect(player).claim())
      .to.emit(claim, "PrizeClaimed")
      .withArgs(player.address, playerPrize);
    await expect(claim.connect(player).claim())
      .to.be.revertedWithCustomError(claim, "AlreadyClaimed");

    await increaseTime(86401);
    await expect(claim.closeClaim()).to.emit(claim, "ClaimClosed");
    const state = await claim.getClaimState();
    expect(state[0]).to.equal(false);
  });

  it("NFT продает яйца, переносит оплату в турнирный vault и scratch превращает яйцо в EggMonet", async function () {
    const { player, nft, tournament } = await deployCore();

    const woodenPrice = await nft.woodenPrice();
    await expect(nft.connect(player).buyEgg(0, 2, { value: woodenPrice * 2n }))
      .to.emit(nft, "EggMinted");

    expect(await ethers.provider.getBalance(await tournament.getAddress())).to.equal(woodenPrice * 2n);
    const eggs = await nft.getUserEggs(player.address);
    expect(eggs).to.have.length(2);

    await expect(nft.connect(player).scratchEgg(eggs[0]))
      .to.emit(nft, "EggScratched");

    expect(await nft.getUserEggs(player.address)).to.have.length(1);
    expect(await nft.getUserEggMonets(player.address)).to.have.length(1);
  });

  it("Tournament принимает состав из 5 EggMonet, блокирует карты и снимает блокировку при отмене", async function () {
    const { player, adminControl, nft, tournament } = await deployCore();
    await makeFastAdminActions(adminControl);
    const tokenIds = Array.from(await mintEggMonets(nft, player.address, 0, 0, 5));

    await tournament.startEpoch(await latestTimestamp());
    await expect(tournament.connect(player).submitWeighing(tokenIds))
      .to.emit(tournament, "WeighingSubmitted");

    const [epoch, day] = await tournament.getCurrentEpochDay();
    expect(await tournament.hasWeighingForDay(player.address, epoch, day)).to.equal(true);
    expect(await nft.isEggMonetLocked(tokenIds[0])).to.equal(true);

    await expect(nft.connect(player).transferEggMonet((await ethers.getSigners())[3].address, tokenIds[0]))
      .to.be.revertedWithCustomError(nft, "EggMonetLocked");

    await expect(tournament.connect(player).cancelWeighing({ value: await tournament.getCancelFee() }))
      .to.emit(tournament, "WeighingCancelled");

    expect(await nft.isEggMonetLocked(tokenIds[0])).to.equal(false);
    expect(await tournament.hasWeighingForDay(player.address, epoch, day)).to.equal(false);
  });

  it("Marketplace держит NFT в escrow, платит продавцу и копит комиссию", async function () {
    const { player, buyer, adminControl, nft, marketplace } = await deployCore();
    await makeFastAdminActions(adminControl);
    const [tokenId] = await mintEggMonets(nft, player.address, 3, 1, 1);
    const price = ethers.parseEther("0.01");

    await nft.connect(player).approve(await marketplace.getAddress(), tokenId);
    await expect(marketplace.connect(player).listEggMonet(tokenId, price))
      .to.emit(marketplace, "EggMonetListed");

    expect(await nft.ownerOf(tokenId)).to.equal(await marketplace.getAddress());
    expect(await marketplace.listingCount()).to.equal(1);

    await expect(marketplace.connect(player).buyEggMonet(0, { value: price }))
      .to.be.revertedWithCustomError(marketplace, "CannotBuyOwn");

    await expect(marketplace.connect(buyer).buyEggMonet(0, { value: price }))
      .to.emit(marketplace, "EggMonetBought");

    expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
    expect(await marketplace.listingCount()).to.equal(0);
    expect(await marketplace.accumulatedFees()).to.equal(price * 500n / 10000n);
  });

  it("Marketplace emergency clear возвращает escrow NFT продавцу", async function () {
    const { player, adminControl, nft, marketplace } = await deployCore();
    await makeFastAdminActions(adminControl);
    const emergencyRole = await adminControl.ROLE_EMERGENCY();
    await adminControl.grantRole(player.address, emergencyRole);

    const [tokenId] = await mintEggMonets(nft, player.address, 7, 2, 1);
    await nft.connect(player).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(player).listEggMonet(tokenId, ethers.parseEther("0.02"));

    await expect(marketplace.connect(player).adminClearListings())
      .to.emit(marketplace, "ListingsCleared");

    expect(await nft.ownerOf(tokenId)).to.equal(player.address);
    expect(await marketplace.listingCount()).to.equal(0);
    expect(await marketplace.pendingClear()).to.equal(false);
  });
});
