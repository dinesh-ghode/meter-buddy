import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  label: string;
  step: number;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function FilterStep({ label, step, value, options, onChange, disabled }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold">
          {step}
        </span>
        {label}
      </Label>
      <Select
        value={value === "" ? "__blank__" : value}
        onValueChange={(v) => onChange(v === "__blank__" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger className="bg-input border-border h-11">
          <SelectValue placeholder={disabled ? "—" : `Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((opt) => (
            <SelectItem key={opt || "__blank__"} value={opt === "" ? "__blank__" : opt}>
              {opt || "(blank)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
