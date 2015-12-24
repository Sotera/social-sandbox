# Start with Ubuntu base image
FROM ubuntu:14.04


RUN apt-get update
RUN apt-get install -y git


# Install git, bc and dependencies
RUN apt-get update && apt-get install -y \
  git \
  bc \
  vim \
  procps \
  curl \
  python \
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

# Clone Caffe repo and move into it
RUN cd /root && git clone https://github.com/BVLC/caffe.git && cd caffe && \
# Copy Makefile
  cp Makefile.config.example Makefile.config && \
# Enable CPU-only
  sed -i 's/# CPU_ONLY/CPU_ONLY/g' Makefile.config && \
# Make
  make -j"$(nproc)" all
# Set ~/caffe as working directory

RUN curl -sL https://deb.nodesource.com/setup | bash -
RUN apt-get install -y nodejs

RUN useradd -ms /bin/bash strong-pm
RUN chown -R strong-pm:strong-pm /usr/local

RUN apt-get install -y build-essential

#RUN su strong-pm -c "npm install -g strong-pm && npm cache clear"
#RUN su strong-pm -c "npm install -g strongloop && npm cache clear"
#RUN su strong-pm -c "npm install -g bower && npm cache clear"
RUN npm install -g strong-pm && npm cache clear
RUN npm install -g strongloop && npm cache clear

# Set up some semblance of an environment
WORKDIR /home/strong-pm
ENV HOME=/home/strong-pm

# Run as non-privileged user inside container
USER strong-pm

# Expose strong-pm port
EXPOSE 8701
ENTRYPOINT ["/usr/bin/sl-pm", "--base", ".", "--listen", "8701"]