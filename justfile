set dotenv-load

export EDITOR := 'vim'

alias f := fmt
alias s := serve

default:
  just --list

fmt:
	prettier --write .

serve:
  python3 -m http.server 8000 --directory ./src
