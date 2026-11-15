import { Star } from "lucide-react";
import { toggleFavouriteTool, useFavouriteTools } from "./favouriteTools";

/** The star that adds a diagram tool to, or removes it from, the teacher's favourite tools. */
export function FavouriteStar({ tool, className, size }: { tool: { id: string; name: string }; className: string; size: number }) {
  const starred = useFavouriteTools().includes(tool.id);
  return (
    <button type="button" className={`${className}${starred ? " is-favourite" : ""}`} aria-pressed={starred} aria-label={`${starred ? "Remove" : "Add"} ${tool.name} ${starred ? "from" : "to"} favourite tools`} title={starred ? "Remove from favourite tools" : "Add to favourite tools"} onClick={() => toggleFavouriteTool(tool.id)}>
      <Star size={size} aria-hidden="true" />
    </button>
  );
}
