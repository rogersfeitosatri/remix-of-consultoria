import * as React from "react";

import { cn } from "@/lib/utils";

const inputClasses =
  "flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const isValidDateParts = (day: string, month: string, year: string) => {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < 1900 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
};

const maskDateBR = (input: string) => {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

const isoDateToBR = (value: unknown) => {
  const iso = String(value || "").split("T")[0];
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

const brDateToISO = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return "";
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (!isValidDateParts(day, month, year)) return "";
  return `${year}-${month}-${day}`;
};

const maskDateTimeBR = (input: string) => {
  const digits = input.replace(/\D/g, "").slice(0, 12);
  const date = maskDateBR(digits.slice(0, 8));
  if (digits.length <= 8) return date;
  const timeDigits = digits.slice(8);
  if (timeDigits.length > 2) return `${date} ${timeDigits.slice(0, 2)}:${timeDigits.slice(2)}`;
  return `${date} ${timeDigits}`;
};

const isoDateTimeToBR = (value: unknown) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : "";
};

const brDateTimeToISO = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (digits.length !== 12) return "";
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);
  if (!isValidDateParts(day, month, year) || Number(hour) > 23 || Number(minute) > 59) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

function maskedChangeEvent(
  event: React.ChangeEvent<HTMLInputElement>,
  value: string,
): React.ChangeEvent<HTMLInputElement> {
  return {
    ...event,
    target: { ...event.target, value },
    currentTarget: { ...event.currentTarget, value },
  } as React.ChangeEvent<HTMLInputElement>;
}

const MaskedDateInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, value, defaultValue, onChange, placeholder = "dd/mm/yyyy", ...props }, ref) => {
    const [text, setText] = React.useState(isoDateToBR(value ?? defaultValue));

    React.useEffect(() => {
      if (value !== undefined) setText(isoDateToBR(value));
    }, [value]);

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        className={cn(inputClasses, className)}
        onChange={(event) => {
          const masked = maskDateBR(event.target.value);
          setText(masked);
          const iso = brDateToISO(masked);
          if (iso || masked === "") onChange?.(maskedChangeEvent(event, iso));
        }}
      />
    );
  },
);

const MaskedDateTimeInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, value, defaultValue, onChange, placeholder = "dd/mm/yyyy HH:mm", ...props }, ref) => {
    const [text, setText] = React.useState(isoDateTimeToBR(value ?? defaultValue));

    React.useEffect(() => {
      if (value !== undefined) setText(isoDateTimeToBR(value));
    }, [value]);

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        className={cn(inputClasses, className)}
        onChange={(event) => {
          const masked = maskDateTimeBR(event.target.value);
          setText(masked);
          const iso = brDateTimeToISO(masked);
          if (iso || masked === "") onChange?.(maskedChangeEvent(event, iso));
        }}
      />
    );
  },
);

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    if (type === "date") return <MaskedDateInput className={className} {...props} ref={ref} />;
    if (type === "datetime-local") return <MaskedDateTimeInput className={className} {...props} ref={ref} />;

    return (
      <input
        type={type}
        className={cn(inputClasses, className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
