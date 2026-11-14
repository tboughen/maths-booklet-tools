import { useEffect, useState } from "react";
import ModernPage from "./LessonBarModelPage";
import { readStorage, type Startup } from "./storage";
import { copyStorageKey } from "../site/copyDocument";
const key = copyStorageKey("maths-booklet-tools:bar-model:v2");
export default function BarModelRoute({ active = true }: { active?: boolean }) {
  const [startup, setStartup] = useState<Startup | null>(null);
  useEffect(() => {
    let current = true;
    void readStorage(
      { getItem: (key) => localStorage.getItem(key) },
      key,
    ).then((s) => {
      if (current) setStartup(s);
    });
    return () => {
      current = false;
    };
  }, []);
  return startup ? (
    <ModernPage active={active} storageKey={key} startup={startup} />
  ) : (
    <p role="status">Opening bar model…</p>
  );
}
