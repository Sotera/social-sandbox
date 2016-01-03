# Start with Ubuntu base image
FROM ubuntu:14.04

# Install git, bc and dependencies
RUN apt-get update --fix-missing && apt-get install -y wget bzip2 ca-certificates \
  sudo \
  git \
  bc \
  vim \
  procps \
  curl \
  libglib2.0-0 \
  libxext6 \
  libsm6 \
  libxrender1 \
  libatlas-base-dev \
  libatlas-dev \
  libboost-all-dev \
  libopencv-dev \
  libprotobuf-dev \
  libgoogle-glog-dev \
  libgflags-dev \
  protobuf-compiler \
  libhdf5-dev \
  libleveldb-dev \
  liblmdb-dev \
  libsnappy-dev

RUN apt-get install -y build-essential
RUN curl -sL https://deb.nodesource.com/setup_0.12 | bash -
RUN apt-get install -y nodejs

RUN npm install -g strong-pm && npm cache clear
RUN npm install -g strongloop && npm cache clear

RUN echo 'export PATH=/opt/conda/bin:$PATH' > /etc/profile.d/conda.sh && \
    wget --quiet https://repo.continuum.io/archive/Anaconda2-2.4.1-Linux-x86_64.sh && \
    /bin/bash /Anaconda2-2.4.1-Linux-x86_64.sh -b -p /opt/conda && \
    rm /Anaconda2-2.4.1-Linux-x86_64.sh

ENV PATH /opt/conda/bin:$PATH

RUN conda install -c https://conda.anaconda.org/memex elasticsearch-py
RUN conda install -c https://conda.anaconda.org/anaconda protobuf

RUN pip install kafka-python

RUN useradd -ms /bin/bash strong-pm
RUN chown -R strong-pm:strong-pm /usr/local

RUN cd /home/strong-pm
# Set up some semblance of an environment
WORKDIR /home/strong-pm
ENV HOME=/home/strong-pm

# Clone Caffe repo and move into it
RUN cd /home/strong-pm && git clone https://github.com/BVLC/caffe.git && cd caffe && \
# just pull a preconfigured Makefile.config from our repo...cheating a little here
  wget --quiet https://raw.githubusercontent.com/Sotera/social-sandbox/event_detection/firmament/caffe/Makefile.config && \
# Make
  make -j"$(nproc)" all

# Make Python Wrapper
RUN cd /home/strong-pm/caffe \
    make pycaffe \
    make distribute \
    wget http://dl.caffe.berkeleyvision.org/bvlc_reference_caffenet.caffemodel

RUN chown -R strong-pm:strong-pm /home/strong-pm/caffe

# Run as non-privileged user inside container
USER strong-pm

ENV PYTHONPATH=/home/strong-pm/caffe/distribute/python/caffe:$PYTHONPATH
ENV PYTHONPATH=/home/strong-pm/caffe/python:$PYTHONPATH

# Expose strong-pm port
EXPOSE 8701
ENTRYPOINT ["/usr/bin/sl-pm", "--base", ".", "--listen", "8701"]