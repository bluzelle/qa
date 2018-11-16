#!/usr/bin/env bash

# check argument received
if [ -z "$1" ]
  then
    echo "No argument received. Please pass in path to swarmDB build originating from root of QA."
    exit 1
fi

# check if pre-existing daemon-build symlink
if [ -d ./daemon-build ]; then
    link=$(cd ./daemon-build; pwd -P)
    echo "Daemon-build symlink already exists. Currently links to $link."
    read -p "Do you want to overwrite this? [y/n]" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf daemon-build
    else
    echo "Aborting linking. Existing symlink unchanged."
        exit 0
    fi
fi

# check if swarm executable exists at path
if [ -f ./$1/output/swarm ]; then
   ln -s $1 daemon-build
   echo "Daemon successfully linked. Harness will be testing against $1"
else
   echo "Error linking Daemon. Please ensure a swarm executable resides in $1/output/"
   exit 1
fi
