# Item Categories with Best Margins

Analysis of which product categories have the highest profit margins based on sale price vs cost.

```gsql category_margins
from order_items
select
  products.category,
  safe_divide(sum(sale_price) - sum(inventory_items.cost), sum(sale_price)) as margin_pct,
  count(*) as items_sold,
  sum(sale_price) as total_revenue
group by products.category
order by margin_pct desc
```

<Row>
  <BarChart data="category_margins" x="products_category" y="margin_pct" title="Profit Margin by Category" />
  <BarChart data="category_margins" x="products_category" y="total_revenue" title="Total Revenue by Category" />
</Row>

## Key Findings

The top 5 categories with the best margins are:

1. **Blazers & Jackets** - 62.1% margin, $300K revenue
2. **Skirts** - 60.3% margin, $102K revenue
3. **Accessories** - 60.0% margin, $427K revenue
4. **Suits & Sport Coats** - 59.9% margin, $628K revenue
5. **Socks & Hosiery** - 59.8% margin, $64K revenue

**Accessories** and **Suits & Sport Coats** stand out as having both high margins (~60%) and substantial revenue volumes ($427K and $628K respectively), making them particularly attractive categories.