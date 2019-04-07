---
layout: post
title:  "Docker cheat sheet"
date:   2018-12-29
categories: [python, docker]
---

Containerising your applications is a great way to ensure reproducibility of your work. Here's a quick sheet on important Docker commands. For more info, also see the Docker [page](https://docs.docker.com/engine/reference/run/) on the `run` command.

Start a Docker container in detached mode using `-d` flag:

```bash
docker run -d --name my-docker-container mysql:5.7
```

After running above command, a container is launched in the background, and its unique ID is simply printed to the terminal. Either that or the friendly name specified by the `---name` flag can be used to address it:

```bash
docker logs my-docker-container # For terminal output from the container
docker ps # List running containers
docker kill my-docker-container # To kill the running container
docker rm my-docker-container # To delete the container
```

To connect to a Docker container and interact with the bash shell:

```bash
docker exec -it my-docker-container bash
```

----------

To map ports of a Docker container to a different range or even the same range to make them accessible to local programs:

```bash
docker run -d -p 3306:8888 mysql:5.7
```
Mount a volume from your local disk into the Docker container:

```bash
docker run -d -p 27017:27017 -v ~/data:/data/db mongo
```

**Note**: Using paths such as `./db` do not work as the `.` is not allowed for the local disk path.

For SQL server Docker images, the `/docker-entrypoint-initdb.d/` folder in the container is where SQL scripts are run from during initialisation:

```bash
docker run -d -p 3306:3306 -v ~/db:/docker-entrypoint-initdb.d/
```

Add environment flags with each `-e` flag:

```bash
docker run -d -p 3306:3306 -v ~/db:/docker-entrypoint-initdb.d/ -e MYSQL_ROOT_PASSWORD=root -e MYSQL_USER=user
```

----------
## Docker files

Docker containers can be made using a `Dockerfile`

```
# ~/Dockerfile (no extension)

FROM python:3.6

EXPOSE 5000:5000

WORKDIR /app
COPY . app/
RUN pip install -r app/requirements.txt

CMD python app.py
```
----------
## Docker compose

Multiple Docker containers can be launched together using `docker-compose`, and be linked so they can communicate. This can be orchestrated using a `docker-compose.yml` file:

```bash
# ~/docker-compose.yml
version: '3'
services:
  app:
    build: ./app
    links:
      - db
    ports:
      - 5000:5000
  db:
    image: mysql:5.7
    ports:
      - 3306:3306
    volumes:
        - ./db/init.sql:/docker-entrypoint-initdb.d/
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_USER: username
```
