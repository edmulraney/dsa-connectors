const TROVE_MANAGER_ADDRESS = "0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2";
const TROVE_MANAGER_ABI = [
  "function getTroveColl(address _borrower) external view returns (uint)",
  "function getTroveDebt(address _borrower) external view returns (uint)",
];

const BORROWER_OPERATIONS_ADDRESS =
  "0x24179CD81c9e782A4096035f7eC97fB8B783e007";
const BORROWER_OPERATIONS_ABI = [
  "function openTrove(uint256 _maxFee, uint256 _LUSDAmount, address _upperHint, address _lowerHint) external payable",
];

const LUSD_TOKEN_ADDRESS = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const LUSD_TOKEN_ABI = [
  "function transfer(address _to, uint256 _value) public returns (bool success)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

const STABILITY_POOL_ADDRESS = "0x66017D22b0f8556afDd19FC67041899Eb65a21bb";

module.exports = {
  TROVE_MANAGER_ADDRESS,
  TROVE_MANAGER_ABI,
  BORROWER_OPERATIONS_ADDRESS,
  BORROWER_OPERATIONS_ABI,
  LUSD_TOKEN_ADDRESS,
  LUSD_TOKEN_ABI,
  STABILITY_POOL_ADDRESS,
};
