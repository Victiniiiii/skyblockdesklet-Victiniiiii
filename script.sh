#!/bin/bash

# Parse script arguments
MODE="$1"
ITEM="$2"

format_number() {
    echo "$1" | awk '{printf("%'\''d\n", $1)}'
}

if [ "$MODE" = "bazaar" ]; then
    API_URL="https://api.hypixel.net/skyblock/bazaar"
    data=$(curl -s "$API_URL")
    sell_price=$(echo "$data" | jq -r ".products.${ITEM}.sell_summary[0].pricePerUnit")
    buy_price=$(echo "$data" | jq -r ".products.${ITEM}.buy_summary[0].pricePerUnit")
    if [[ "$sell_price" == "null" || "$buy_price" == "null" ]]; then
        echo "$ITEM"
        echo "Invalid item"
    else
        sell_price_int=$(printf "%.0f" "$sell_price")
        buy_price_int=$(printf "%.0f" "$buy_price")
        formatted_sell_price=$(format_number "$sell_price_int")
        formatted_buy_price=$(format_number "$buy_price_int")
        echo "$ITEM"
        echo "Buy $formatted_sell_price - $formatted_buy_price Sell"
    fi

elif [ "$MODE" = "auction" ]; then
    API_URL="https://sky.coflnet.com/api/auctions/tag/${ITEM}/active/bin"
    data=$(curl -s "$API_URL")
  
    count=$(echo "$data" | jq 'length')
  
    if [ "$count" -gt 0 ]; then
        lowest_price=$(echo "$data" | jq -r '.[0].startingBid')
        lowest_price_int=$(printf "%.0f" "$lowest_price")
        formatted_lowest_price=$(format_number "$lowest_price_int")
        
        echo "$ITEM"
        echo "Lowest BIN: $formatted_lowest_price coins"
    else
        echo "$ITEM"
        echo "No BIN listings found"
    fi
else
    echo "Invalid mode: $MODE"
    echo "Use 'bazaar' or 'auction'"
fi
