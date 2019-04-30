#!/usr/bin/env bash

# check argument received
if [ -z "$1" ]
  then
    echo "No argument received. Please pass in relative path to swarmDB binary originating from root of QA."
    echo "
    # Example:
    # If you're building swarmDB from source:
    #
    # ├── qa
    # └── swarmDB
    #     └── build
    #         └── output
    #             └── swarm executable

    $ yarn link-daemon ../swarmDB/build/output
    "
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
if [ -f ./$1/swarm ]; then
   ln -s $1 daemon-build
   echo "Daemon successfully linked. Tests will be ran against $1"
else
   echo "Error linking Daemon. Please ensure a swarm executable resides in $1/"
   exit 1
fi
