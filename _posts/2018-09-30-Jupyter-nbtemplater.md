---
layout: post
title:  "Programmatically generating Jupyter notebooks"
date:   2018-09-30
categories: [python, general]
---

Jupyter notebooks are a great tool for data science projects, and provide a nice level of interactivity that can't be achieved with a normal Python script (at least not with minimal effort). Sometimes, however, you may want to re-use a Jupyter notebook in different projects, where the project structure is very similar, such as when using the `cookiecutter` data science project structure. To aid the programmatic generation of Jupyter notebook files, I have put together a Python tool, `nb-templater`, to automate this process.

<div class="github-card">
    <h3 class="repo-name">
        <div class="row">
          <div class="col-lg-2">
              <i class="icon icon_repo"></i>
          </div>
          <div class="col-lg-10">
              jupyter-nb-templater
              <br>
              ismailuddin
          </div>
        </div>
    </h3>
    <hr>
    <p>
        A tool for generating Python scripts to programmatically generate Jupyter notebooks.
    </p>
    <a href="https://www.github.com/ismailuddin/jupyter-nb-templater" class="btn social-media github smaller">
        <i class="fab fa-github"></i> View repo
    </a>
</div>


## Programmatically generating notebook files
Using `nb-templater` you can provide a Jupyter notebook file to use as a template, from which a Python script is generated to programmatically generate the notebook file. The output file can be modified, such that it takes an input as an argument, which it injects into one of the cells.

The individual cells in the notebook are defined as string variables in the Python script. Hence, using either `.format()` or the `%` operator, variables could be injected into the cells. This could be useful if you needed to change a variable in the cell which defines the filename for a data file to import.

![Jupyter nbtemplater](/assets/img/nbtemplater.gif)

Hopefully this is of some use to somebody! Improvements and suggestions are welcome!
