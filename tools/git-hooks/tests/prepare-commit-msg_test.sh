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

function test_AquaMesh_lazy_approach() {
  export TEST_BRANCH="feature/feature-1"
  assert_equals "AquaMesh:FEATURE-1 My commit message" "$($SCRIPT "My commit message")"
}

function test_ignore_all_when_using_AquaMesh_full_approach() {
  export TEST_BRANCH="feature/feature-2"
  assert_equals "" "$($SCRIPT "AquaMesh:FEATURE-2 My commit message")"
}

function test_AquaMesh_lazy_approach_dev_branch() {
  export TEST_BRANCH="dev"
  assert_equals "AquaMesh:DEV My commit message" "$($SCRIPT "My commit message")"
}

function test_AquaMesh_lazy_approach_main_branch() {
  export TEST_BRANCH="main"
  assert_equals "AquaMesh:MAIN My commit message" "$($SCRIPT "My commit message")"
}
