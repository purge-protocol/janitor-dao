# Purge Network - Janitor DAO

### Community-based purging of dead assets from Ethereum.


  An experimental DAO that incentivizes the destruction of illiquid and unwanted value representation on Ethereum. 
  
  We want to clean it up.

  The contracts: 
    
  ## PurgeToken.sol
  - Deflationary governance token
  - Voting rights delegation
  - 1% of each transfer burnt
  - Capped supply of 10 million
  - Used to vote on what we purge next and how
  
  ## ShareManager.sol
  - Stake an LPT and commit an amount of [shitcoin x] to be purged.
  - You will never get the purged asset back.
  - 1/2 will be aggressively dumped by an AMM which in extreme cases should create a feedback loop and lead to the accelerated destruction.
  - 1/2 will be burned permanently by sending to an unrecoverable address.
  - The more you purge the more voting power you have to help guide the project 

  
#### The remaining contracts are utilities and or tooling.
  - Migrations.sol
  - MockERC20.sol

#### ToDo
- Timelock.sol
- GovernorAlpha.sol
- Wrapped token factory  