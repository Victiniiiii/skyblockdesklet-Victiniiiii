#!/bin/bash

API_URL="https://api.hypixel.net/skyblock/bazaar"
ITEM="${1:-COMPOST}"  # Use COMPOST if no item is provided

data=$(curl -s "$API_URL")

sell_price=$(echo "$data" | jq -r ".products.${ITEM}.sell_summary[0].pricePerUnit")
buy_price=$(echo "$data" | jq -r ".products.${ITEM}.buy_summary[0].pricePerUnit")

if [[ "$sell_price" == "null" || "$buy_price" == "null" ]]; then
    echo "Invalid item: $ITEM"
else
    echo "$ITEM Buy Price: $buy_price coins"
    echo "$ITEM Sell Price: $sell_price coins"
fi
