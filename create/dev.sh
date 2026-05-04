# runs the installer in a temporary directory and drops you into it
# no shebang line because you have to `source dev.sh` for it to change your
# directory (you can use `popd` to get back)

create_dir="${${(%):-%N}:A:h}"
temp_root="$(mktemp -d "${TMPDIR:-/tmp/}graphene-create-dev-XXXXXX")" || return 1

if [[ "$1" == "--" ]]; then
  shift
fi

tarball_name="$(
  cd "$create_dir" &&
    pnpm pack --quiet | tail -n 1
)" || return 1

tarball_path="$create_dir/$tarball_name"

echo "Using temp workspace: $temp_root"
echo "Running packed initializer interactively..."

if ! (
  cd "$temp_root" &&
    npm exec --yes --package "$tarball_path" -- create-graphene "$@"
); then
  rm -f "$tarball_path"
  echo ""
  echo "Initializer failed. Temp workspace kept at: $temp_root" >&2
  return 1
fi

rm -f "$tarball_path"
pushd "$temp_root"
