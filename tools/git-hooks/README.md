# How to use Git hooks

## 🧠 Why
Git hooks are scripts that run automatically every time a particular event occurs in a Git repository. They let you customize Git's internal behavior and trigger customizable actions at key points in the development life cycle.

In this case we are changing the `prepare-commit-msg` hook, to add the boilerplate in the beginning of the commit message automatically. 

### Example.
#### Commit message:
- My commit message 
#### It transforms into:
- AquaMesh:DEV My commit message

## 🚀 Getting Started
To allow this behaviour to happen, it is needed to execute the following command:
```bash
tools/git-hooks/init.sh
```

To check if it worked, run this command:
```bash
ls -lisa .git/hooks/
```
This file should appear -> `prepare-commit-msg`.

## 🧪 Test (Bashunit)
To test that the git hook is working as intended. Execute the following command:

```bash
tools/git-hooks/lib/bashunit tools/git-hooks/tests
```
This command is using `bashunit` (a [bash testing framework](https://bashunit.typeddevs.com/)) over the tests folder to check if the tests are passing.