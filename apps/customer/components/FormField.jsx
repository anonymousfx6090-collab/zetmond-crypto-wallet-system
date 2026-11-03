"use client";
import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Smartphone,
  KeyRound,
} from "lucide-react";

export default function FormField({
  name,
  label,
  error,
  optional,
  ...options
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = options.type === "password";
  const Icon = isPassword
    ? LockKeyhole
    : options.type === "email"
      ? Mail
      : options.type === "tel"
        ? Smartphone
        : KeyRound;
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <div className="input-wrap">
        <Icon size={18} className="input-icon" aria-hidden="true" />
        <input
          {...options}
          id={name}
          name={name}
          required={!optional}
          type={isPassword && visible ? "text" : options.type}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          className={isPassword ? "has-toggle" : undefined}
        />
        {isPassword && (
          <button
            className="password-toggle"
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-controls={name}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <span className="field-error" id={`${name}-error`}>
          {error[0]}
        </span>
      )}
    </div>
  );
}
