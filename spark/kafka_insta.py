#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

"""
 Counts words in UTF8 encoded, '\n' delimited text received from the network every second.
 Usage: kafka_wordcount.py <zk> <topic>

 To run this on your local machine, you need to setup Kafka and create a producer first, see
 http://kafka.apache.org/documentation.html#quickstart

 and then run the example
    `$ bin/spark-submit --jars external/kafka-assembly/target/scala-*/\
      spark-streaming-kafka-assembly-*.jar examples/src/main/python/streaming/kafka_wordcount.py \
      localhost:2181 test`
"""
from __future__ import print_function

import sys
import json
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from kafka import SimpleProducer, KafkaClient
from nltk.corpus import stopwords

def filt(a):
    if a[0] != '' and a[1] > 1 and a[0] not in stopwords.words('english'):
        return True
    return False

def send(x):
    kafka     = KafkaClient("localhost:9092")
    producer  = SimpleProducer(kafka)
    for record in x:
        producer.send_messages("instacounts",str(record))

def returnText(x):
    return ' '.join([ y['caption']['text'].lower() for y in json.loads(x[1]) if y.get('caption') and y['caption'].get('text') and y['caption']['text'].strip() != ''])
    #return len(json.loads(x[1]))
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: kafka_wordcount.py <zk> <topic>", file=sys.stderr)
        exit(-1)

    kafka     = KafkaClient("localhost:9092")
    producer  = SimpleProducer(kafka)

    sc = SparkContext(appName="PythonStreamingKafkaWordCount")
    ssc = StreamingContext(sc, 120)

    zkQuorum, topic = sys.argv[1:]
    kvs = KafkaUtils.createStream(ssc, zkQuorum, "spark-streaming-consumer", {topic: 1})
    lines = kvs.map(returnText)
    #count = lines.reduce(lambda a,b: a+b)
    counts = lines.flatMap(lambda line: line.replace('#',' ').split(" ")) \
        .map(lambda word: (word, 1)) \
        .reduceByKey(lambda a, b: a+b).filter(filt)
    producer.send_messages("instacounts","yo")
    counts.pprint()
    counts.foreachRDD(lambda rdd: rdd.foreachPartition(send))
    

    ssc.start()
    ssc.awaitTermination()
