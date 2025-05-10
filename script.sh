#!/bin/bash

API_URL="https://api.hypixel.net/skyblock/bazaar"

curl -s "$API_URL" | jq -r '
  .products.COMPOST.sell_summary[0].pricePerUnit as $sellPrice |
  .products.COMPOST.buy_summary[0].pricePerUnit as $buyPrice |
  "COMPOST Buy Price: \($buyPrice) coins\nCOMPOST Sell Price: \($sellPrice) coins"
'
