set dotenv-load

export EDITOR := 'nvim'

alias f := fmt
alias s := serve

all: fmt-check forbid

default:
	just --list

fmt:
	prettier --write .

fmt-check:
  prettier --check .

forbid:
  ./bin/forbid

serve:
	python3 -m http.server 8000 --directory ./src
