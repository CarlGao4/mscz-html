#!/usr/bin/env python3

import glob
import os
import pathlib
import shutil
import subprocess

start_dir = pathlib.Path(os.getcwd())
output_dir = start_dir / "dist"
script_dir = pathlib.Path(__file__).parent.resolve()
os.chdir(script_dir)

# List all tags and branches
subprocess.run(["git", "fetch", "--tags"])
subprocess.run(["git", "fetch", "--all"])
remote_branches = subprocess.check_output(["git", "branch", "-r", "--format=%(refname:short)"]).decode("utf-8").splitlines()
remote_branches = [branch.split("/")[1] for branch in remote_branches if "origin/" in branch]
for branch in remote_branches:
    subprocess.run(["git", "checkout", "-b", branch, f"origin/{branch}"])
tags = subprocess.check_output(["git", "tag"]).decode("utf-8").splitlines()
branches = subprocess.check_output(["git", "branch", "--format=%(refname:short)"]).decode("utf-8").splitlines()
print("Branches:")
print(branches)
print("Tags:")
print(tags)
all_branches = tags + branches

for branch in all_branches:
    subprocess.run(["git", "clean", "-fdx"])
    subprocess.run(["git", "checkout", "."])
    subprocess.run(["git", "checkout", branch])
    (output_dir / branch).mkdir(parents=True, exist_ok=True)
    if "dev" in branch:
        # In this case, we just copy all files to the output directory
        shutil.copytree(script_dir, output_dir / branch, dirs_exist_ok=True)
    else:
        # In this case, only copy the src directory to the output directory
        src_dir = script_dir / "src"
        shutil.copytree(src_dir, output_dir / branch, dirs_exist_ok=True)
    # Then run uglifyjs and uglifycss on the output directory
    for file in glob.glob(str(output_dir / branch / "**/*.js"), recursive=True):
        f = pathlib.Path(file)
        subprocess.run(["uglifyjs", str(f), "-o", str(f.with_suffix(".min.js")), "--compress"])
    for file in glob.glob(str(output_dir / branch / "**/*.css"), recursive=True):
        f = pathlib.Path(file)
        subprocess.run(["uglifycss", str(f), "--output", str(f.with_suffix(".min.css"))])
