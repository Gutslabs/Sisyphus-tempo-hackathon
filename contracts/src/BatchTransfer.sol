// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface for transferFrom batching.
interface IERC20TransferFrom {
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Batch ERC-20 transfers in a single transaction.
/// Caller must have approved this contract for each token being transferred.
contract BatchTransfer {
  struct Transfer {
    address token;
    address to;
    uint256 amount;
  }

  error LengthZero();
  error TransferFailed(uint256 index);

  function batchTransfer(Transfer[] calldata transfers) external {
    uint256 n = transfers.length;
    if (n == 0) revert LengthZero();

    for (uint256 i = 0; i < n; i++) {
      Transfer calldata t = transfers[i];
      bool ok = IERC20TransferFrom(t.token).transferFrom(msg.sender, t.to, t.amount);
      if (!ok) revert TransferFailed(i);
    }
  }
}

