"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function NotificationItem({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="w-full rounded-md border p-2 text-left text-sm transition-colors hover:bg-muted/60"
    >
      <p className="font-medium">{item.title}</p>
      <p className="text-muted-foreground text-xs mt-1">{item.message}</p>
      <p className="text-[11px] text-muted-foreground mt-1">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </p>
    </button>
  );
}

function formatMetadataItems(notification) {
  const metadata = notification?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const details = [];

  if (metadata.amount != null) {
    details.push({
      label: "Amount",
      value: `Rs.${Number(metadata.amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    });
  }
  if (metadata.category) {
    details.push({ label: "Category", value: String(metadata.category) });
  }
  if (metadata.accountName) {
    details.push({ label: "Account", value: String(metadata.accountName) });
  }
  if (metadata.recurringInterval) {
    details.push({
      label: "Frequency",
      value: String(metadata.recurringInterval).toLowerCase(),
    });
  }
  if (metadata.processedAt) {
    const dt = new Date(metadata.processedAt);
    details.push({
      label: "Processed",
      value: Number.isNaN(dt.getTime())
        ? String(metadata.processedAt)
        : dt.toLocaleString(),
    });
  }
  if (metadata.transactionType) {
    details.push({
      label: "Transaction Type",
      value: String(metadata.transactionType).toLowerCase(),
    });
  }
  if (metadata.goalTitle) {
    details.push({ label: "Goal", value: String(metadata.goalTitle) });
  }
  if (metadata.completedAmount != null) {
    details.push({
      label: "Completed Amount",
      value: `Rs.${Number(metadata.completedAmount || 0).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}`,
    });
  }
  if (metadata.targetAmount != null) {
    details.push({
      label: "Target Amount",
      value: `Rs.${Number(metadata.targetAmount || 0).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}`,
    });
  }
  if (metadata.requiredMonthly != null) {
    details.push({
      label: "Required Monthly",
      value: `Rs.${Number(metadata.requiredMonthly || 0).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}`,
    });
  }
  if (metadata.contributionsThisMonth != null) {
    details.push({
      label: "This Month Saved",
      value: `Rs.${Number(metadata.contributionsThisMonth || 0).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}`,
    });
  }
  if (metadata.percentageUsed != null) {
    details.push({
      label: "Budget Used",
      value: `${Number(metadata.percentageUsed || 0).toFixed(1)}%`,
    });
  }
  if (metadata.budgetAmount != null) {
    details.push({
      label: "Budget Amount",
      value: `Rs.${Number(metadata.budgetAmount || 0).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}`,
    });
  }
  if (notification?.title === "Monthly Report Ready") {
    details.push({
      label: "Next Step",
      value: "Check your email for details.",
    });
  }

  if (details.length > 0) return details;

  const hiddenKeys = new Set([
    "accountId",
    "budgetId",
    "goalId",
    "sourceTransactionId",
    "transactionId",
    "userId",
  ]);

  Object.entries(metadata).forEach(([key, value]) => {
    if (hiddenKeys.has(key) || value == null || value === "") return;
    details.push({
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase()),
      value: String(value),
    });
  });

  if (details.length > 0) return details;

  return [
    { label: "Event", value: notification?.title || "Update" },
    { label: "Type", value: notification?.type || "info" },
  ];
}

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load notifications");
      setItems(Array.isArray(json?.data?.items) ? json.data.items : []);
      setUnreadCount(Number(json?.data?.unreadCount || 0));
    } catch (error) {
      toast.error(error.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to mark as read");
      setUnreadCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      toast.error(error.message || "Failed to mark as read");
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  const handleOpenNotification = (item) => {
    setSelectedNotification(item);
    setOpen(false);
    setDetailOpen(true);
  };
  const metadataItems = formatMetadataItems(selectedNotification);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-[10px] leading-5 text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[360px]">
          <div className="flex items-center justify-between px-2 pt-1">
            <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </Button>
          </div>
          <DropdownMenuSeparator />
          <div className="max-h-80 space-y-2 overflow-auto p-2">
            {loading && items.length === 0 && (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
            {!loading && items.length === 0 && (
              <p className="text-xs text-muted-foreground">No notifications yet</p>
            )}
            {items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                onClick={handleOpenNotification}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title || "Notification"}</DialogTitle>
            <DialogDescription>
              {selectedNotification?.createdAt
                ? formatDistanceToNow(new Date(selectedNotification.createdAt), {
                    addSuffix: true,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border p-3">
              <p className="text-sm leading-relaxed">
                {selectedNotification?.message || "-"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Type: {selectedNotification?.type || "info"}
            </p>
            {selectedNotification?.metadata && (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Summary
                </p>
                <div className="space-y-1.5 text-sm">
                  {metadataItems.map((item) => (
                    <p key={item.label}>
                      <span className="text-muted-foreground">{item.label}:</span>{" "}
                      {item.value}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
