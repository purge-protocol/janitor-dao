const { expectRevert, time } = require('@openzeppelin/test-helpers');
const PurgeToken = artifacts.require('PurgeToken');
const ShareManager = artifacts.require('ShareManager');
const MockERC20 = artifacts.require('MockERC20');
const MINTER_ROLE = web3.utils.keccak256('MINTER_ROLE');
const Web3 = require('web3')

contract('ShareManager', ([alice, bob, carol, dev, minter]) => {
    before(async () => {
        this.purgeToken = await PurgeToken.new({ from: alice });
    });

    it('should set correct state variables', async () => {
        this.shareManager = await ShareManager.new(this.purgeToken.address, dev, '100', '0', '1000', { from: alice });
        await this.purgeToken.grantRole(this.purgeToken.MINTER_ROLE, this.shareManager.address);
        
        const purgeToken = await this.shareManager.purgeToken();
        const devaddr = await this.shareManager.devaddr();
        const minter = await alice;
        assert.equal(purgeToken.valueOf(), this.purgeToken.address);
        assert.equal(devaddr.valueOf(), dev);
        const creatorIsMinter = await this.purgeToken.hasRole(this.purgeToken.MINTER_ROLE, minter);
        assert.equal(creatorIsMinter, true);
    });

    it('should allow dev and only dev to update dev', async () => {
        this.shareManager = await ShareManager.new(this.purgeToken.address, dev, '100', '0', '1000', { from: alice });
        assert.equal((await this.shareManager.devaddr()).valueOf(), dev);
        await expectRevert(this.shareManager.dev(bob, { from: bob }), 'PURGE Security: We\'ll be right over.');
        await this.shareManager.dev(bob, { from: dev });
        assert.equal((await this.shareManager.devaddr()).valueOf(), bob);
        await this.shareManager.dev(alice, { from: bob });
        assert.equal((await this.shareManager.devaddr()).valueOf(), alice);
    })

    context('With ERC/LP token added to the field', () => {

        before(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });
        });

        it('should allow emergency withdraw', async () => {
            this.shareManager = await ShareManager.new(this.purgeToken.address, dev, '10', '100', '81340', { from: alice }); 
            await this.shareManager.add('100', this.lp.address, true);
            await this.lp.approve(this.shareManager.address, '1000', { from: bob });
            await this.shareManager.deposit(0, '100', { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '900');
            await this.shareManager.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });

        it('should not sell food before the mall opens', async () => {
            // 6 per block pouring rate starting at block 100 with bonus for 2 (1 week halving periods)
            this.shareManager = await ShareManager.new(this.purgeToken.address, dev, web3.utils.toWei('6','ether'), '100', '182000', { from: alice }); 
            await this.purgeToken.grantRole(MINTER_ROLE, this.shareManager.address);
            await this.shareManager.add('100', this.lp.address, true);
            await this.lp.approve(this.shareManager.address, '1000', { from: bob });
            await this.shareManager.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('89');
            await this.shareManager.deposit(0, '0', { from: bob }); // block 90
            assert.equal((await this.purgeToken.balanceOf(bob)).valueOf(), '0');
        });

        it('emission test 1200', async () => {
            let targetBlock = '1200';
            await time.advanceBlockTo(targetBlock);
            await this.shareManager.deposit(0, '0', { from: bob });
            const days = targetBlock / 6500;
            let bb = await this.purgeToken.balanceOf(bob);
            let db = await this.purgeToken.balanceOf(dev);
            let ts = await this.purgeToken.totalSupply();
            let br = await this.shareManager.getRewardPerBlock(targetBlock);
            console.log('$> -------------------------------------');
            console.log('$> Miner reward per block: ' + Web3.utils.fromWei(br, 'ether'));
            console.log('$> Balance @ block ' + targetBlock + ' / < ' + days + ' days: ' + Web3.utils.fromWei(bb, 'ether') + ' PURGE');
            console.log('$> Dev balance: ' + Web3.utils.fromWei(db) + ' PURGE');
            console.log('$> Total Supply: ' + Web3.utils.fromWei(ts) + ' PURGE');
            // assert.equal((await this.purgeToken.balanceOf(bob)).toString(), '24505000000000000000000');
        });

        it('emission test 10k', async () => {
            console.log('$> -------------------------------------');
            targetBlock = '10000';
            await time.advanceBlockTo(targetBlock);
            await this.shareManager.deposit(0, '0', { from: bob });
            const days = targetBlock / 6500;
            bb = await this.purgeToken.balanceOf(bob);
            db = await this.purgeToken.balanceOf(dev);
            ts = await this.purgeToken.totalSupply();
            br = await this.shareManager.getRewardPerBlock(targetBlock);
            console.log('$> Miner reward per block: ' + Web3.utils.fromWei(br, 'ether'));
            console.log('$> Balance @ block ' + targetBlock + ' / < ' + days + ' days: ' + Web3.utils.fromWei(bb, 'ether') + ' PURGE');
            console.log('$> Dev balance: ' + Web3.utils.fromWei(db) + ' PURGE');
            console.log('$> Total Supply: ' + Web3.utils.fromWei(ts) + ' PURGE');
            // assert.equal((await this.purgeToken.balanceOf(bob)).toString(), '49505000000000000000000'); 
        });

            // await time.advanceBlockTo('99');
            // await this.shareManager.deposit(0, '0', { from: bob }); // block 100
            // assert.equal((await this.rumToken.balanceOf(bob)).valueOf(), '0');
            // await time.advanceBlockTo('100');
            // await this.shareManager.deposit(0, '0', { from: bob }); // block 101 where bob gets all the blox at 5x ()
            // assert.equal((await this.rumToken.balanceOf(bob)).toString(), '5');
            // await time.advanceBlockTo('104');
            // // await this.shareManager.deposit(0, '0', { from: bob }); // block 105 -> bob has 5 blocks @ 5x = 250
            // // assert.equal((await this.rumToken.balanceOf(bob)).toString(), '250');
            // // assert.equal((await this.rumToken.balanceOf(dev)).toString(), '5');
            // // assert.equal((await this.rumToken.totalSupply()).toString(), '255');

            // check after 1k blocks
            // await time.advanceBlockTo('1104');
            // await this.shareManager.deposit(0, '0', { from: bob }); // block 105 -> bob has 5 blocks @ 5x = 250 ~4 hrs
            // assert.equal((await this.rumToken.balanceOf(bob)).toString(), '5025');
            // assert.equal((await this.rumToken.balanceOf(dev)).toString(), '100');
            // assert.equal((await this.rumToken.totalSupply()).toString(), '5125');
            
            
            // let prev_miner_bal = new web3.utils.BN(0);
            // for (var i = 1101; i < 10000; i++) {
            //     await time.advanceBlockTo(i);
            //     await this.shareManager.deposit(0, '0', { from: bob });
            //     let minerBal = await this.rumToken.balanceOf(bob);
            //     let devBal = await this.rumToken.balanceOf(dev);
            //     let totalSupply = await this.rumToken.totalSupply();
            //     let epoch = await this.shareManager.getEpochForBlock(i);
            //     // let halv = await this.shareManager.getHalvFactor(i);
            //     console.log("==============================");
            //     // console.log(epoch);
            //     console.log('Epoch: ' + epoch.toString());
            //     console.log("Block: " + i);
            //     console.log("Miner bal: " + web3.utils.fromWei(minerBal.toString(), 'ether'));
            //     console.log("Miner delta: " + web3.utils.fromWei((minerBal.sub(prev_miner_bal)).toString(), 'ether'));
            //     console.log("Dev bal: " + web3.utils.fromWei(devBal.toString(), 'ether'));
            //     console.log("Total Supply:" + web3.utils.fromWei(totalSupply.toString(), 'ether'));
            //     console.log("==============================");
            //     prev_miner_bal = minerBal;
            // }
            
            // // // check inflation after 1k blocks of emission
            // await this.shareManager.deposit(0, '0', { from: bob }); // 1 day
            // let bBal = await this.rumToken.balanceOf(bob);
            // assert.equal(web3.utils.fromWei(bBal.toString(), 'ether'), 10010);
            // console.log('staker balance: ' + web3.utils.fromWei(bBal, 'ether'));
            // assert.equal((await this.rumToken.balanceOf(dev)).toString(), '125');
            // assert.equal((await this.rumToken.totalSupply()).toString(), '2625');

            // await time.advanceBlockTo('40420');
            // await this.shareManager.deposit(0, '0', { from: bob }); // 1 day
            // assert.equal((await this.rumToken.balanceOf(bob)).toString(), '28810');
     // });

//         it('should not distribute HASHYs if no one deposit', async () => {
//             // 100 per block farming rate starting at block 200 with bonus until block 1000
//             this.chef = await MasterChef.new(this.hashy.address, dev, '100', '200', '1000', { from: alice });
//             await this.hashy.grantRole(MINTER_ROLE, this.chef.address);
//             await this.chef.add('100', this.lp.address, true);
//             await this.lp.approve(this.chef.address, '1000', { from: bob });
//             await time.advanceBlockTo('199');
//             assert.equal((await this.hashy.totalSupply()).valueOf(), '0');
//             await time.advanceBlockTo('204');
//             assert.equal((await this.hashy.totalSupply()).valueOf(), '0');
//             await time.advanceBlockTo('209');
//             await this.chef.deposit(0, '10', { from: bob }); // block 210
//             assert.equal((await this.hashy.totalSupply()).valueOf(), '0');
//             assert.equal((await this.hashy.balanceOf(bob)).valueOf(), '0');
//             assert.equal((await this.hashy.balanceOf(dev)).valueOf(), '0');
//             assert.equal((await this.lp.balanceOf(bob)).valueOf(), '990');
//             await time.advanceBlockTo('219');
//             await this.chef.withdraw(0, '10', { from: bob }); // block 220
//             assert.equal((await this.hashy.totalSupply()).valueOf(), '11000');
//             assert.equal((await this.hashy.balanceOf(bob)).valueOf(), '10000');
//             assert.equal((await this.hashy.balanceOf(dev)).valueOf(), '1000');
//             assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
//         });

//         it('should distribute HASHYs properly for each staker', async () => {
//             // 100 per block farming rate starting at block 300 with bonus until block 1000
//             this.chef = await MasterChef.new(this.hashy.address, dev, '100', '300', '1000', { from: alice });
//             await this.hashy.grantRole(MINTER_ROLE, this.chef.address);
//             await this.chef.add('100', this.lp.address, true);
//             await this.lp.approve(this.chef.address, '1000', { from: alice });
//             await this.lp.approve(this.chef.address, '1000', { from: bob });
//             await this.lp.approve(this.chef.address, '1000', { from: carol });
//             // Alice deposits 10 LPs at block 310
//             await time.advanceBlockTo('309');
//             await this.chef.deposit(0, '10', { from: alice });
//             // Bob deposits 20 LPs at block 314
//             await time.advanceBlockTo('313');
//             await this.chef.deposit(0, '20', { from: bob });
//             // Carol deposits 30 LPs at block 318
//             await time.advanceBlockTo('317');
//             await this.chef.deposit(0, '30', { from: carol });
//             // Alice deposits 10 more LPs at block 320. At this point:
//             //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
//             //   MasterChef should have the remaining: 10000 - 5666 = 4334
//             await time.advanceBlockTo('319')
//             await this.chef.deposit(0, '10', { from: alice });
//             assert.equal((await this.hashy.totalSupply()).valueOf(), '11000');
//             assert.equal((await this.hashy.balanceOf(alice)).valueOf(), '5666');
//             assert.equal((await this.hashy.balanceOf(bob)).valueOf(), '0');
//             assert.equal((await this.hashy.balanceOf(carol)).valueOf(), '0');
//             assert.equal((await this.hashy.balanceOf(this.chef.address)).valueOf(), '4334');
//             assert.equal((await this.hashy.balanceOf(dev)).valueOf(), '1000');
//             // Bob withdraws 5 LPs at block 330. At this point:
//             //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
//             await time.advanceBlockTo('329')
//             await this.chef.withdraw(0, '5', { from: bob });
//             assert.equal((await this.hashy.totalSupply()).valueOf(), '22000');
//             assert.equal((await this.hashy.balanceOf(alice)).valueOf(), '5666');
//             assert.equal((await this.hashy.balanceOf(bob)).valueOf(), '6190');
//             assert.equal((await this.hashy.balanceOf(carol)).valueOf(), '0');
//             assert.equal((await this.hashy.balanceOf(this.chef.address)).valueOf(), '8144');
//             assert.equal((await this.hashy.balanceOf(dev)).valueOf(), '2000');
//             // Alice withdraws 20 LPs at block 340.
//             // Bob withdraws 15 LPs at block 350.
//             // Carol withdraws 30 LPs at block 360.
//             await time.advanceBlockTo('339')
//             await this.chef.withdraw(0, '20', { from: alice });
//             await time.advanceBlockTo('349')
//             await this.chef.withdraw(0, '15', { from: bob });
//             await time.advanceBlockTo('359')
//             await this.chef.withdraw(0, '30', { from: carol });
//             assert.equal((await this.hashy.totalSupply()).valueOf(), '55000');
//             assert.equal((await this.hashy.balanceOf(dev)).valueOf(), '5000');
//             // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
//             assert.equal((await this.hashy.balanceOf(alice)).valueOf(), '11600');
//             // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
//             assert.equal((await this.hashy.balanceOf(bob)).valueOf(), '11831');
//             // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
//             assert.equal((await this.hashy.balanceOf(carol)).valueOf(), '26568');
//             // All of them should have 1000 LPs back.
//             assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
//             assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
//             assert.equal((await this.lp.balanceOf(carol)).valueOf(), '1000');
//         });

//         it('should give proper HASHYs allocation to each pool', async () => {
//             // 100 per block farming rate starting at block 400 with bonus until block 1000
//             this.chef = await MasterChef.new(this.hashy.address, dev, '100', '400', '1000', { from: alice });
//             await this.hashy.grantRole(MINTER_ROLE, this.chef.address);
//             await this.lp.approve(this.chef.address, '1000', { from: alice });
//             await this.lp2.approve(this.chef.address, '1000', { from: bob });
//             // Add first LP to the pool with allocation 1
//             await this.chef.add('10', this.lp.address, true);
//             // Alice deposits 10 LPs at block 410
//             await time.advanceBlockTo('409');
//             await this.chef.deposit(0, '10', { from: alice });
//             // Add LP2 to the pool with allocation 2 at block 420
//             await time.advanceBlockTo('419');
//             await this.chef.add('20', this.lp2.address, true);
//             // Alice should have 10*1000 pending reward
//             assert.equal((await this.chef.pendingHashyTokens(0, alice)).valueOf(), '10000');
//             // Bob deposits 10 LP2s at block 425
//             await time.advanceBlockTo('424');
//             await this.chef.deposit(1, '5', { from: bob });
//             // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
//             assert.equal((await this.chef.pendingHashyTokens(0, alice)).valueOf(), '11666');
//             await time.advanceBlockTo('430');
//             // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
//             assert.equal((await this.chef.pendingHashyTokens(0, alice)).valueOf(), '13333');
//             assert.equal((await this.chef.pendingHashyTokens(1, bob)).valueOf(), '3333');
//         });

//         it('should stop giving bonus HASHYs after the bonus period ends', async () => {
//             // 100 per block farming rate starting at block 500 with bonus until block 600
//             this.chef = await MasterChef.new(this.hashy.address, dev, '100', '500', '600', { from: alice });
//             await this.hashy.grantRole(MINTER_ROLE, this.chef.address);
//             await this.lp.approve(this.chef.address, '1000', { from: alice });
//             await this.chef.add('1', this.lp.address, true);
//             // Alice deposits 10 LPs at block 590
//             await time.advanceBlockTo('589');
//             await this.chef.deposit(0, '10', { from: alice });
//             // At block 605, she should have 1000*10 + 100*5 = 10500 pending.
//             await time.advanceBlockTo('605');
//             assert.equal((await this.chef.pendingHashyTokens(0, alice)).valueOf(), '10500');
//             // At block 606, Alice withdraws all pending rewards and should get 10600.
//             await this.chef.deposit(0, '0', { from: alice });
//             assert.equal((await this.chef.pendingHashyTokens(0, alice)).valueOf(), '0');
//             assert.equal((await this.hashy.balanceOf(alice)).valueOf(), '10600');
//         });
   });
});
