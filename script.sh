#!/bin/bash

API_URL="https://api.hypixel.net/skyblock/bazaar"
ITEM="${1:-COMPOST}"  # Use COMPOST if no item is provided

data=$(curl -s "$API_URL")

sell_price=$(echo "$data" | jq -r ".products.${ITEM}.sell_summary[0].pricePerUnit")
buy_price=$(echo "$data" | jq -r ".products.${ITEM}.buy_summary[0].pricePerUnit")

if [[ "$sell_price" == "null" || "$buy_price" == "null" ]]; then
    echo "Invalid item: $ITEM"
else
    sell_price_int=$(printf "%.0f" "$sell_price")
    buy_price_int=$(printf "%.0f" "$buy_price")

    echo "$ITEM"
    echo "Buy $sell_price_int - $buy_price_int Sell"
fi
