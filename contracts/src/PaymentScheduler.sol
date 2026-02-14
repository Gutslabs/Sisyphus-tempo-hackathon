// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PaymentScheduler
 * @notice One-time scheduled and recurring payments for TIP-20/ERC20 on Tempo.
 *         Uses OpenZeppelin for security (ReentrancyGuard, SafeERC20, Ownable, Pausable).
 * @dev One-time: payer escrows tokens at creation; anyone can trigger execute after executeAt.
 *      Recurring: no escrow; each execution pulls from payer via transferFrom; keeper triggers.
 */
contract PaymentScheduler is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    struct OneTimeSchedule {
        address payer;
        address token;
        address recipient;
        uint256 amount;
        uint256 executeAt;
        bool executed;
        bool cancelled;
    }

    struct RecurringSchedule {
        address payer;
        address token;
        address recipient;
        uint256 amount;
        uint256 intervalSeconds;
        uint256 nextDueTime;
        uint256 endTime; // 0 = no end
        bool cancelled;
    }

    uint256 public nextOneTimeId;
    uint256 public nextRecurringId;
    mapping(uint256 => OneTimeSchedule) public oneTimeSchedules;
    mapping(uint256 => RecurringSchedule) public recurringSchedules;

    event OneTimeScheduled(
        uint256 indexed id,
        address indexed payer,
        address token,
        address recipient,
        uint256 amount,
        uint256 executeAt
    );
    event OneTimeExecuted(uint256 indexed id);
    event OneTimeCancelled(uint256 indexed id);
    event RecurringScheduled(
        uint256 indexed id,
        address indexed payer,
        address token,
        address recipient,
        uint256 amount,
        uint256 intervalSeconds,
        uint256 nextDueTime,
        uint256 endTime
    );
    event RecurringExecuted(uint256 indexed id, uint256 nextDueTime);
    event RecurringCancelled(uint256 indexed id);

    error InvalidSchedule();
    error TooEarly();
    error AlreadyExecuted();
    error Cancelled();
    error NotPayer();
    error RecurringNotDue();
    error RecurringEnded();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Create a one-time scheduled payment. Tokens are pulled from payer now and held until executeAt.
     */
    function createScheduled(
        address token,
        address recipient,
        uint256 amount,
        uint256 executeAt
    ) external whenNotPaused nonReentrant returns (uint256 id) {
        if (recipient == address(0) || amount == 0 || executeAt <= block.timestamp) revert InvalidSchedule();
        id = nextOneTimeId++;
        oneTimeSchedules[id] = OneTimeSchedule({
            payer: msg.sender,
            token: token,
            recipient: recipient,
            amount: amount,
            executeAt: executeAt,
            executed: false,
            cancelled: false
        });
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit OneTimeScheduled(id, msg.sender, token, recipient, amount, executeAt);
        return id;
    }

    /**
     * @notice Execute a one-time scheduled payment. Callable by anyone once executeAt has passed.
     */
    function executeScheduled(uint256 id) external whenNotPaused nonReentrant {
        OneTimeSchedule storage s = oneTimeSchedules[id];
        if (s.payer == address(0)) revert InvalidSchedule();
        if (s.executed) revert AlreadyExecuted();
        if (s.cancelled) revert Cancelled();
        if (block.timestamp < s.executeAt) revert TooEarly();

        s.executed = true;
        IERC20(s.token).safeTransfer(s.recipient, s.amount);
        emit OneTimeExecuted(id);
    }

    /**
     * @notice Cancel a one-time schedule. Only payer. Refunds escrowed tokens.
     */
    function cancelScheduled(uint256 id) external nonReentrant {
        OneTimeSchedule storage s = oneTimeSchedules[id];
        if (msg.sender != s.payer) revert NotPayer();
        if (s.executed) revert AlreadyExecuted();
        if (s.cancelled) revert Cancelled();

        s.cancelled = true;
        IERC20(s.token).safeTransfer(s.payer, s.amount);
        emit OneTimeCancelled(id);
    }

    /**
     * @notice Create a recurring payment. No escrow; each execution pulls from payer.
     * @param intervalSeconds Time between each payment (e.g. 30 days = 30 * 24 * 3600).
     * @param endTime Unix timestamp after which no more payments; 0 = no end.
     * @param firstDueTime First execution time; 0 = use block.timestamp (due immediately).
     */
    function createRecurring(
        address token,
        address recipient,
        uint256 amount,
        uint256 intervalSeconds,
        uint256 endTime,
        uint256 firstDueTime
    ) external whenNotPaused returns (uint256 id) {
        if (recipient == address(0) || amount == 0 || intervalSeconds == 0) revert InvalidSchedule();
        id = nextRecurringId++;
        uint256 nextDue = firstDueTime == 0 ? block.timestamp : firstDueTime;
        recurringSchedules[id] = RecurringSchedule({
            payer: msg.sender,
            token: token,
            recipient: recipient,
            amount: amount,
            intervalSeconds: intervalSeconds,
            nextDueTime: nextDue,
            endTime: endTime,
            cancelled: false
        });
        emit RecurringScheduled(id, msg.sender, token, recipient, amount, intervalSeconds, nextDue, endTime);
        return id;
    }

    /**
     * @notice Execute the next occurrence of a recurring payment. Callable by anyone (keeper).
     *         Pulls amount from payer to recipient and advances nextDueTime.
     */
    function executeRecurring(uint256 id) external whenNotPaused nonReentrant {
        RecurringSchedule storage s = recurringSchedules[id];
        if (s.payer == address(0)) revert InvalidSchedule();
        if (s.cancelled) revert Cancelled();
        if (block.timestamp < s.nextDueTime) revert RecurringNotDue();
        if (s.endTime != 0 && s.nextDueTime > s.endTime) revert RecurringEnded();

        uint256 nextDue = s.nextDueTime + s.intervalSeconds;
        s.nextDueTime = nextDue;
        IERC20(s.token).safeTransferFrom(s.payer, s.recipient, s.amount);
        emit RecurringExecuted(id, nextDue);
    }

    /**
     * @notice Cancel a recurring schedule. Only payer. Future executions are skipped.
     */
    function cancelRecurring(uint256 id) external {
        RecurringSchedule storage s = recurringSchedules[id];
        if (msg.sender != s.payer) revert NotPayer();
        if (s.cancelled) revert Cancelled();
        s.cancelled = true;
        emit RecurringCancelled(id);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
