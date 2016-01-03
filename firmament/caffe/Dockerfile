# Start with Ubuntu base image
FROM jstnldrs/strongpm:1.0

# Clone Caffe repo and move into it
RUN cd /home/strong-pm && git clone https://github.com/BVLC/caffe.git && cd caffe && \
# just pull a preconfigured Makefile.config from our repo...cheating a little here
  wget --quiet https://raw.githubusercontent.com/Sotera/social-sandbox/event_detection/firmament/caffe/Makefile.config && \
# Make
  make -j"$(nproc)" all

# Make Python Wrapper
RUN cd /home/strong-pm/caffe && \
  make pycaffe && \
  make distribute

RUN cd /home/strong-pm/caffe/models/bvlc_reference_caffenet && \
  wget --quiet http://dl.caffe.berkeleyvision.org/bvlc_reference_caffenet.caffemodel

RUN chown -R strong-pm:strong-pm /home/strong-pm/caffe

# Run as non-privileged user inside container
USER strong-pm

ENV PYTHONPATH=/home/strong-pm/caffe/distribute/python/caffe:$PYTHONPATH
ENV PYTHONPATH=/home/strong-pm/caffe/python:$PYTHONPATH

# Expose strong-pm port
EXPOSE 8701
ENTRYPOINT ["/usr/bin/sl-pm", "--base", ".", "--listen", "8701"]