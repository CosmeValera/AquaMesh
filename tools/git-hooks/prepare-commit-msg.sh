#!/bin/bash

#
# Render the Jira Ticket from the given branch.
#
# Eg: CASE 1: Given branch "feat/TEAM-123-foo-bar" should return `TEAM-123`
# Eg: CASE 2: Given branch "dev" should return `DEV`
#
function normalize_ticket() {
  local gitBranch=$1
  # shellcheck disable=SC2046
  # shellcheck disable=SC2005

  # CASE 1: Return the Jira ticket from the branch name
  echo "$gitBranch" |
    grep -Eo '^(\w+\/)?(\w+-)?(\w+[-_])?[0-9]+' |
    grep -Eo '(\w+[-])?[0-9]+' |
    tr "[:lower:]" "[:upper:]"

  # CASE 2: Return branch name uppercase if it's a dev, or main branch
  if [[ "$gitBranch" == "dev" || "$gitBranch" == "develop" || "$gitBranch" == "master" || "$gitBranch" == "main" ]]; then
    echo "$gitBranch" | tr "[:lower:]" "[:upper:]"
  fi
}

#
# Render the commit following the SAFe practice.
#
function render_message() {
  local commitMsg=$1
  local jiraTicket=$2
  
  if [[ "$DEBUG" == true ]]; then
    echo "commitMsg = $commitMsg"
    echo "jiraTicket = $jiraTicket"
  fi

  if [[ $jiraTicket != '' ]]; then
    echo "AquaMesh:$jiraTicket $commitMsg"
  else
    echo "$commitMsg"
  fi
}

function check_AquaMesh_commit() {
  local commitMsg=$1
  readonly COMMIT_MSG_REGEX="^AquaMesh:[\s\S]*"
  if [[ "$commitMsg" =~ $COMMIT_MSG_REGEX || "$commitMsg" =~ $COMMIT_MSG_REGEX_DEV ]]; then
    if [[ "$DEBUG" == true ]]; then
      echo "sanitizedMsg = $sanitizedMsg"
      echo "The commit sanitizedMsg is already a AquaMesh commit: ignoring the hook."
    fi

    exit 0;
  fi
}

function render_result() {
  local updated_msg=$1
  local file=$2

  if [[ "$TEST" == true ]]; then
    echo "$updated_msg"
  else
    echo "$updated_msg" > "$file"
  fi
}

##################
###### MAIN ######
##################

# Useful for local testing and debugging. Usage:
# TEST=true .git/hooks/prepare-commit-msg "My commit message"
# DEBUG=true TEST=true .git/hooks/prepare-commit-msg "AquaMesh:BRANCH-668 My commit message"
[ -z "$TEST" ] && TEST=false
[ -z "$DEBUG" ] && DEBUG=false

if [[ "$TEST" == true ]]; then
  ORIGINAL_MSG="${1:-"the commit message"}"
else
  file=$1
  ORIGINAL_MSG=$(cat "$file")
fi

check_AquaMesh_commit "$ORIGINAL_MSG"

GIT_BRANCH=${TEST_BRANCH:-"$(git rev-parse --abbrev-ref HEAD)"}
JIRA_TICKET=$(normalize_ticket "$GIT_BRANCH")

UPDATED_MSG=$(render_message "$ORIGINAL_MSG" "$JIRA_TICKET")

render_result "$UPDATED_MSG" "$file"