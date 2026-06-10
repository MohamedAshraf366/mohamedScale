I double-checked the code and the live database. The current 319.04 SAR unit price is wrong.

## Why the screen shows 319.04 now

For this material:

- Material: Cement Block: Regular, Uninsulated, 3 Holes — 10 cm
- Supplier selected by resolver: راف الشمال
- Raw supplier price: 0.98 SAR per piece
- Delivery rate for this zone: 300 SAR per trip / MOQ load
- Margin: 6%

The current fast resolver is doing this:

```text
MOQ used = 1        <-- wrong
Delivery per unit = 300 / 1 = 300
Final unit price = (0.98 + 300) × 1.06
Final unit price = 319.0388 = 319.04 SAR
```

So the 319.04 is coming from delivery being divided by 1 piece instead of by the real load quantity.

## Why that is wrong

The supplier quote has no MOQ saved on the supplier_material row, but the material subcategory has a default MOQ of 1000.

So the resolver should not use 1. It should inherit the default MOQ/load size.

For this material, it should use:

```text
MOQ / load size = 1000 pieces
```

## What should happen exactly

The line price should be calculated like this:

### 1. Resolve the supplier

The system picks the supplier using the Supplier Selection model for the material and project zone.

For this case, it resolved:

```text
Supplier = راف الشمال
Raw unit price = 0.98 SAR
```

### 2. Find the delivery rate

The system finds the delivery rate for that supplier and the project zone.

For this case:

```text
Delivery rate = 300 SAR per trip/load
Zone = RYD.11001
```

### 3. Find the load size / MOQ

The system should use this order:

```text
supplier quote MOQ
then material/subcategory/category default MOQ
then only use 1 as a last emergency fallback
```

For this case:

```text
Supplier MOQ = empty
Subcategory MOQ = 1000
Final MOQ used = 1000
```

### 4. Calculate number of trips

Delivery is not simply divided by the supplier MOQ always. It depends on quantity.

```text
Trips = ceiling(quantity / MOQ)
```

Examples:

```text
Quantity 500  -> ceiling(500 / 1000)  = 1 trip
Quantity 1000 -> ceiling(1000 / 1000) = 1 trip
Quantity 1500 -> ceiling(1500 / 1000) = 2 trips
Quantity 2000 -> ceiling(2000 / 1000) = 2 trips
```

### 5. Calculate delivery per unit

```text
Delivery per unit = total delivery cost / quantity
```

Examples with 300 SAR per trip:

```text
Quantity 500:
Trips = 1
Total delivery = 300
Delivery per unit = 300 / 500 = 0.60

Quantity 1000:
Trips = 1
Total delivery = 300
Delivery per unit = 300 / 1000 = 0.30

Quantity 1500:
Trips = 2
Total delivery = 600
Delivery per unit = 600 / 1500 = 0.40

Quantity 2000:
Trips = 2
Total delivery = 600
Delivery per unit = 600 / 2000 = 0.30
```

So yes: the unit price should change when quantity changes from 500 to 1000, because delivery per unit changes.

### 6. Add margin

Final customer unit price should be:

```text
Final unit price = (supplier raw unit price + delivery per unit) × (1 + margin %)
```

For this material with 0.98 raw price and 6% margin:

```text
Quantity 500:
(0.98 + 0.60) × 1.06 = 1.6748 SAR

Quantity 1000:
(0.98 + 0.30) × 1.06 = 1.3568 SAR

Quantity 1500:
(0.98 + 0.40) × 1.06 = 1.4628 SAR

Quantity 2000:
(0.98 + 0.30) × 1.06 = 1.3568 SAR
```

## One more important rule

If multiple lines use the same supplier and same delivery rate, the best calculation is grouped delivery:

```text
Group quantity = sum of all matching lines
Trips = ceiling(group quantity / MOQ)
Delivery per unit = total group delivery / group quantity
```

That prevents charging a full delivery trip separately for every line when they can ride on the same truck/load.

## What is currently broken

There are three issues:

1. The fast row resolver uses MOQ = 1 when supplier MOQ is empty. It is not inheriting the subcategory default MOQ of 1000.
2. The fast row resolver receives quantity, but the database function does not actually use quantity to calculate trips.
3. The frontend currently resolves the line immediately, but it does not correctly re-price the unit price when quantity changes from 500 to 1000.

There is also an inconsistency between the fast resolver and the saved quotation recalculation:

- The fast resolver ignores supplier_material status and uses the current price 0.98.
- The saved total function still has older approved-status logic in part of the calculation.

These two paths must be made identical, otherwise the draft screen and saved totals can disagree.

## Fix plan

I will make one pricing path the source of truth:

1. Update `resolve_line_pricing` so it calculates delivery using:
   - inherited MOQ/load size,
   - actual quantity,
   - trip rounding,
   - delivery per unit,
   - margin.

2. Update the quotation builder so quantity changes trigger re-pricing immediately.

3. Update the batch/auto-fill path so it uses `landed_unit_price`, not raw supplier cost.

4. Align saved quotation recalculation with the same supplier/price rules as the fast resolver, so draft price and saved price match.

5. Keep the UI simple:

```text
Resolving... while calculating
Final unit price shown after supplier + delivery + margin are calculated
No misleading 319.04 caused by MOQ = 1
```