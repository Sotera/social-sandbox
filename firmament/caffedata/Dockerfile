# Start with Ubuntu base image
FROM jstnldrs/strongcaffe:1.0

#You CAN do this...but the download is incredibly slow.  The image on docker hub should have the file

RUN cd /home/strong-pm/caffe/models/bvlc_reference_caffenet && \
    wget --quiet http://dl.caffe.berkeleyvision.org/bvlc_reference_caffenet.caffemodel