The easiest way to format numbers and dates in Graphene is through component attributes. You can pass in either of the following:

* [Excel-style format codes](https://support.microsoft.com/en-us/office/number-format-codes-in-excel-for-mac-5026bbd6-04bc-48cd-bf33-80f18b4eae68) (e.g., `fmt="$#,##0.0"`)
* [Graphene's built-in formats](#built-in-formats) (e.g., `fmt=usd2k`)

For example, you can use the `fmt` attribute to format values inside a BigValue component:

```markdown
<BigValue
  data=sales_data
  value=sales
  fmt="$#,##0"
/>
```

For charts, use the `ECharts` component for custom formatting logic (axis labels, tooltips, and series labels) via ECharts formatters in `config`.

For convenience charts (`BarChart`, `LineChart`, `AreaChart`, `ScatterPlot`, `PieChart`), Graphene applies sensible defaults and uses field metadata (for example, currency units) when formatting inferred value axes.

# Built-in Formats

Graphene supports a variety of date/time, number, percentage, and currency formats.

## Auto-Formatting

Wherever you see `auto` listed beside a format, that means Graphene will automatically format your value based on the context it is in.

For example, Graphene automatically formats large numbers into shortened versions based on the size of the median number in a column (e.g., 4,000,000 → 4M).

You can choose to handle these numbers differently by choosing a specific format code. For example, if Graphene is formatting a column as millions, but you want to see all numbers in thousands, you could use the `num0k` format, which will show all numbers in the column in thousands with 0 decimal places.

## Dates

Graphene supports the following date formats:

* `ddd` - Short day name (e.g., Mon, Tue)
* `dddd` - Full day name (e.g., Monday, Tuesday)
* `mmm` - Short month name (e.g., Jan, Feb)
* `mmmm` - Full month name (e.g., January, February)
* `yyyy` - Four-digit year
* `shortdate` - Short date format (e.g., Jan 9/22)
* `longdate` - Long date format (e.g., January 9, 2022)
* `fulldate` - Full date format (e.g., Monday January 9, 2022)
* `mdy` - Month/day/year (e.g., 1/9/22)
* `dmy` - Day/month/year (e.g., 9/1/22)
* `hms` - Time format (e.g., 11:45:03 AM)

## Currencies

Supported currencies include USD, AUD, BRL, CAD, CNY, EUR, GBP, JPY, INR, KRW, NGN, RUB, and SEK.

In order to use currency tags, use the currency code, optionally appended with:

* a number indicating the number of decimal places to show (0-2)
* a letter indicating the order of magnitude to show ("","k", "m", "b")

For example, the available tags for USD are:

* `usd` (auto) - Automatically formats based on value size
* `usd0`, `usd1`, `usd2` - USD with 0, 1, or 2 decimal places
* `usd0k`, `usd1k`, `usd2k` - USD in thousands (e.g., $64k)
* `usd0m`, `usd1m`, `usd2m` - USD in millions (e.g., $42M)
* `usd0b`, `usd1b`, `usd2b` - USD in billions (e.g., $1B)

Similar patterns apply to other supported currencies.

## Numbers

The default number format (when no `fmt` is specified) automatically handles decimal places and summary units (in the same way that `usd` does for currency).

Available number formats:

* `num0`, `num1`, `num2`, `num3`, `num4` - Numbers with 0-4 decimal places
* `num0k`, `num1k`, `num2k` - Numbers in thousands (e.g., 64k)
* `num0m`, `num1m`, `num2m` - Numbers in millions (e.g., 42M)
* `num0b`, `num1b`, `num2b` - Numbers in billions (e.g., 1B)
* `id` - Integer format for IDs
* `fract` - Fraction format
* `mult`, `mult0`, `mult1`, `mult2` - Multiplier format (e.g., 5.32x)
* `sci` - Scientific notation

## Percentages

Available percentage formats:

* `pct` (auto) - Automatically formats percentages based on value
* `pct0` - Percentage with 0 decimal places (e.g., 73%)
* `pct1` - Percentage with 1 decimal place (e.g., 73.1%)
* `pct2` - Percentage with 2 decimal places (e.g., 73.10%)
* `pct3` - Percentage with 3 decimal places (e.g., 73.100%)
