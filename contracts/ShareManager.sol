pragma solidity 0.6.12;

// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PurgeToken.sol";

// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once PURGE is sufficiently
// distributed and the community can govern itself.
// Have fun. Cheers!
contract ShareManager is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // At any point in time, the amount of tokens
        // entitled to a user and pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accMinedTokenPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accMinedTokenPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points tokens to this pool. tokens to distribute per block.
        uint256 lastRewardBlock;  // Last block number that distribution occurs.
        uint256 accMinedTokenPerShare; // Accumulated Tokens per share, times 1e12. See below.
    }

    // The PURGE TOKEN!
    PurgeToken public purgeToken;
    // Dev address.
    address public devaddr;
    // Block number when bonus  period ends.
    uint256 public bonusEndBlock;
    // Tokens created per block.
    uint256 public minedPerBlock;
    // Bonus muliplier early community/users
    uint256 public constant BONUS_MULTIPLIER = 10;
    // emission halvenings every n blocks
    uint256 public halvingPeriod = 91000; // 45500;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        PurgeToken _purgeToken,
        address _devaddr,
        uint256 _minedPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock
    ) public {
        purgeToken = _purgeToken;
        devaddr = _devaddr;
        minedPerBlock = _minedPerBlock;
        startBlock = _startBlock;
        bonusEndBlock = _bonusEndBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    // can we check for this?
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accMinedTokenPerShare: 0
        }));
    }

    // Update the given pool's allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

     // check halving factor at a specific block
    function getHalveningFactor(uint blockNumber) public view returns (uint256) {
        return 2**( ( blockNumber.sub(startBlock) ).div(halvingPeriod) );
    }

    // "Halvening" factor of current block
    function getCurrentHalveningFactor() public view returns (uint256) {
        return 2**( ( block.number.sub(startBlock) ).div(halvingPeriod) );
    }

    // reward prediction at specific block
    function getRewardPerBlock(uint blockNumber) public view returns (uint256) {
        if (block.number > startBlock){
            return minedPerBlock/( 2**( ( blockNumber.sub(startBlock) ).div(halvingPeriod) ) );
        } else {
            return 0;
        }
    }

    // current reward per block
    function getCurrentRewardPerBlock() public view returns (uint256) {
        if (block.number > startBlock){
            return minedPerBlock/( 2**( ( block.number.sub(startBlock) ).div(halvingPeriod) ) );
        } else {
            return 0;
        }
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        } else if (_from >= bonusEndBlock) {
            return _to.sub(_from);
        } else {
            return bonusEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                _to.sub(bonusEndBlock)
            );
        }
    }

    // View function to see pending tokens on frontend.
    function pendingTokens(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accMinedTokenPerShare = pool.accMinedTokenPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            
            uint256 halvingFactor = 2**( ( block.number.sub(startBlock) ).div(halvingPeriod) );

            uint256 minedTokenReward = multiplier.mul(minedPerBlock).mul(pool.allocPoint).div(totalAllocPoint).div(halvingFactor);
            
            accMinedTokenPerShare = accMinedTokenPerShare.add(minedTokenReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accMinedTokenPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        
        uint256 halvingFactor = 2**( ( block.number.sub(startBlock) ).div(halvingPeriod) );
        
        uint256 tokenReward = multiplier.mul(minedPerBlock).mul(pool.allocPoint).div(totalAllocPoint).div(halvingFactor);

        // mint dev tokens
        purgeToken.mint(devaddr, tokenReward.div(100)); // 1%

        // mint holder tokens
        purgeToken.mint(address(this), tokenReward);

        pool.accMinedTokenPerShare = pool.accMinedTokenPerShare.add(tokenReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens for PURGE allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accMinedTokenPerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                safeTokenTransfer(msg.sender, pending);
            }
        }
        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accMinedTokenPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "PURGE: Withdraw unavailable");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accMinedTokenPerShare).div(1e12).sub(user.rewardDebt);
        if(pending > 0) {
            safeTokenTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accMinedTokenPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe token transfer function, just in case if rounding error causes pool to not have enough tokens.
    function safeTokenTransfer(address _to, uint256 _amount) internal {
        uint256 miningBal = purgeToken.balanceOf(address(this));
        if (_amount > miningBal) {
            purgeToken.transfer(_to, miningBal);
        } else {
            purgeToken.transfer(_to, _amount);
        }
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "PURGE Security: We'll be right over.");
        devaddr = _devaddr;
    }

}
