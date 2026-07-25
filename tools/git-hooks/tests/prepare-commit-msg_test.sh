#!/bin/bash

HOOKS_ROOT_DIR="$(dirname "${BASH_SOURCE[0]}")/.."
SCRIPT="$HOOKS_ROOT_DIR/prepare-commit-msg.sh"

function set_up_before_script() {
  export TEST=true
}

function tear_down_after_script() {
  unset TEST
  unset SCRIPT
}

function test_RabbitHole_lazy_approach() {
  export TEST_BRANCH="feature/feature-1"
  assert_equals "RabbitHole:FEATURE-1 My commit message" "$($SCRIPT "My commit message")"
}

function test_ignore_all_when_using_RabbitHole_full_approach() {
  export TEST_BRANCH="feature/feature-2"
  assert_equals "" "$($SCRIPT "RabbitHole:FEATURE-2 My commit message")"
}

function test_RabbitHole_lazy_approach_dev_branch() {
  export TEST_BRANCH="dev"
  assert_equals "RabbitHole:DEV My commit message" "$($SCRIPT "My commit message")"
}

function test_RabbitHole_lazy_approach_main_branch() {
  export TEST_BRANCH="main"
  assert_equals "RabbitHole:MAIN My commit message" "$($SCRIPT "My commit message")"
}
