import ScanItem from "./ScanItem";

/** Manual entry is the same flow as scanning, minus capture and detection. */
export default function AddItem() {
  return <ScanItem mode="manual" />;
}
