#!/usr/bin/env bash

if [ "$1" != "" ] && [ "$2" != "" ]; then
    cd ../daemon-build/output/$2; ./swarm -c $1
elif [ "$1" != "" ]; then
    cd ../daemon-build/output; ./swarm -c $1
else
    cd ../daemon-build/output; ./swarm
fi

