import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DevicesList from "./DevicesList";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; limitReached?: boolean }

/** Devices that can keep songs for offline listening (five per account). */
const DevicesDialog = ({ open, onOpenChange, limitReached }: Props) => {
  const [limit, setLimit] = useState(5);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Your offline devices</DialogTitle>
          <DialogDescription>
            {limitReached
              ? `You can keep offline songs on up to ${limit} devices. Remove one to save songs here.`
              : `Songs you save play offline on up to ${limit} devices. Removing a device clears its offline songs.`}
          </DialogDescription>
        </DialogHeader>
        {open && <DevicesList onLimit={setLimit} />}
      </DialogContent>
    </Dialog>
  );
};

export default DevicesDialog;
