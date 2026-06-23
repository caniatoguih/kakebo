import * as React from "react"
import { Input } from "@/components/ui/input"

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number | string | null;
  onChange?: (value: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("")

    const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(val)
    }

    React.useEffect(() => {
      if (value !== undefined && value !== null && value !== '') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value
        if (!isNaN(numValue)) {
          setDisplayValue(formatCurrency(numValue))
        } else {
          setDisplayValue("")
        }
      } else {
        setDisplayValue("")
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, "")
      if (!rawValue) {
        setDisplayValue("")
        onChange?.(0)
        return
      }
      const numValue = Number(rawValue) / 100
      setDisplayValue(formatCurrency(numValue))
      onChange?.(numValue)
    }

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
      />
    )
  }
)
CurrencyInput.displayName = "CurrencyInput"
