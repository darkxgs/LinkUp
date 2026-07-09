#!/bin/bash

# Build functions first
echo "🔨 Building functions codebase..."
npm --prefix functions run build || exit 1

# List of all functions to deploy
FUNCTIONS=(
  "acceptAgencyHostInviteByCode"
  "acceptDirectAgencyInvite"
  "addAgencyChatMember"
  "adminCreateAgencyDirect"
  "adminCreateAppUser"
  "adminDeleteAppUsers"
  "adminDeleteAllAgencies"
  "adminDeleteAgency"
  "adminExpressActivateApplication"
  "adminGrantCoins"
  "adminSendBroadcast"
  "adminVerifyAgencyHost"
  "backfillPublicAccountIds"
  "cancelMatch"
  "cancelAgencyHostInvite"
  "confirmAgencyHostGender"
  "createMatch"
  "createShareLink"
  "deleteAdminUser"
  "endCall"
  "enterAgencyLiveRoom"
  "generateLiveKitToken"
  "getAgencyMemberBalances"
  "getHostDashboardStats"
  "listAgentWithdrawals"
  "listMyAgencyInvites"
  "listMyBdInvites"
  "listMyReceivedInvites"
  "lookupUserByIdentifier"
  "openAgencyChat"
  "processPendingAccountDeletions"
  "purchaseAndSendStoreItem"
  "pushOnIncomingCallCreated"
  "rejectDirectAgencyInvite"
  "removeAgencyChatMember"
  "resolveShareLink"
  "reviewAgencyApplication"
  "sendAgencyHostInvite"
  "shareRedirect"
  "signInWithPublicAccountId"
  "submitAgencyApplication"
  "creditAgencyPearlsOnGift"
  "sendBdAgencyInvite"
)

BATCH_SIZE=2
total=${#FUNCTIONS[@]}

echo "🚀 Starting deployment of $total functions in batches of $BATCH_SIZE..."

for ((i=0; i<$total; i+=$BATCH_SIZE)); do
  batch=("${FUNCTIONS[@]:$i:$BATCH_SIZE}")
  
  # Format target string as functions:func1,functions:func2
  targets=""
  for func in "${batch[@]}"; do
    if [ -z "$targets" ]; then
      targets="functions:$func"
    else
      targets="$targets,functions:$func"
    fi
  done
  
  echo "--------------------------------------------------"
  echo "📦 Deploying batch: $targets ($(($i + ${#batch[@]})) of $total)"
  echo "--------------------------------------------------"
  
  firebase deploy --only "$targets"
  
  if [ $? -ne 0 ]; then
    echo "⚠️ Failed to deploy batch: $targets"
    echo "Sleeping for 10 seconds before attempting next batch..."
    sleep 10
  else
    echo "✅ Successfully deployed batch: $targets"
  fi
done

echo "🎉 Sequential deployment process finished!"
