import { useState, useRef, useEffect, createElement, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';

interface InlineEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  as?: TextElement;
  className?: string;
  placeholder?: string;
  canEdit: boolean;
  multiline?: boolean;
}

export function InlineEditableText({
  value,
  onChange,
  as: Component = 'p',
  className,
  placeholder = 'Clique para editar...',
  canEdit,
  multiline = false
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  const initialValueRef = useRef(value);

  // Update initial value ref when prop changes (but only when not editing)
  useEffect(() => {
    if (!isEditing) {
      initialValueRef.current = value;
      // Also update the DOM content when value changes externally
      if (elementRef.current && elementRef.current.textContent !== value) {
        elementRef.current.textContent = value || placeholder;
      }
    }
  }, [value, isEditing, placeholder]);

  const handleFocus = () => {
    if (!canEdit) return;
    setIsEditing(true);
    initialValueRef.current = value;
  };

  const handleBlur = () => {
    setIsEditing(false);
    const newValue = elementRef.current?.textContent || '';
    // Only trigger onChange if value actually changed
    if (newValue !== value && newValue !== placeholder) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Enter saves (unless multiline is allowed)
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      elementRef.current?.blur();
    }
    // Escape reverts
    if (e.key === 'Escape') {
      if (elementRef.current) {
        elementRef.current.textContent = initialValueRef.current || placeholder;
      }
      elementRef.current?.blur();
    }
  };

  // Non-editable mode - just render the text
  if (!canEdit) {
    return createElement(Component, { className }, value || placeholder);
  }

  // CRITICAL FIX: Use dangerouslySetInnerHTML to avoid React reconciliation conflicts
  // with contentEditable. React shouldn't manage the children of contentEditable elements.
  return createElement(
    Component,
    {
      ref: elementRef,
      className: cn(
        className,
        "outline-none cursor-text transition-all duration-200",
        "focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:rounded-sm",
        isEditing && "bg-primary/5",
        !value && !isEditing && "text-muted-foreground/50 italic"
      ),
      contentEditable: true,
      suppressContentEditableWarning: true,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      "data-placeholder": placeholder,
      style: {
        minWidth: '20px',
        minHeight: '1em',
      },
      // Use dangerouslySetInnerHTML to prevent insertBefore errors
      // React won't try to reconcile children, avoiding DOM conflicts
      dangerouslySetInnerHTML: { __html: value || placeholder },
    }
  );
}

