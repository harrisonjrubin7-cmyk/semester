#!/bin/sh
# Stop Redis, wait until it is really gone, start it again with $REDIS_OPTS, wait until it answers.
redis-cli -p 6399 shutdown nosave >/dev/null 2>&1
while redis-cli -p 6399 ping >/dev/null 2>&1; do sleep 0.1; done
sleep 1
eval redis-server --port 6399 $REDIS_OPTS --daemonize yes >/dev/null
until redis-cli -p 6399 ping >/dev/null 2>&1; do sleep 0.1; done
echo "dbsize_after_restart=$(redis-cli -p 6399 dbsize)"
