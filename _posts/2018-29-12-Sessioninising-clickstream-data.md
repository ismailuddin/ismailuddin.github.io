---
layout: post
title:  "Sessionising clickstream data"
date:   2018-12-29
categories: [python, general, data_science, multiprocessing]
---

A common task when analysing clickstream data is to sessionise the individual clicks. This invovles aggregating individual clicks from a given cookie ID, into groups of clicks, whereby successive clicks have a time difference that is not greater than the session timeout value. The session timeout value is typically taken to be **20** or **30 minutes**. 

This means a given session (group of clicks) can be either be very long or short, so long as successive clicks within the group do not have a time difference between them greater than session timeout.

The process of calculating this, however, can become quite computationally intensive, as you continuously need to perform a lookup on the previous row's data in your data structure to calculate the time difference. There are multiple approaches to going about this, using methods in SQL, Spark (via SQL syntax) and so forth. Here, I shall show one approach to speed up the process using `pandas` and Python's `multiprocessing` module.

## Generating a clickstream dataset
To begin with, we first need a dummy clickstream dataset to work with. We can generate one easily in Python using the following code:

```python
import uuid
import datetime
import random
import pandas as pd
import numpy as np
import chance  # Module to generate random words

def time_difference() -> int:
    """Returns a time difference on average less than 30 minutes."""
    return int(random.gammavariate(2, 1) * 10)

N_OF_PAGES, N_OF_USERS = 50, 500
DAYS, USERS_PER_DAY = 50, 100
CLICKS_PER_DAY = (300, 500)

pages = [f'P_{chance.word()}' for x in range(N_OF_PAGES)]
users = [str(uuid.uuid4()) for x in range(N_OF_USERS)]

clicks = []
start = datetime.datetime(2019, 1, 1)
for day in range(DAYS):
    user_set = random.choices(users, k=USERS_PER_DAY)  # Python 3.X only
    for user in user_set:
        date = start + datetime.timedelta(days=day)
        for click in range(random.randint(*CLICKS_PER_DAY)):
            td = time_difference()
            date = date + datetime.timedelta(minutes=td)
            page = random.choice(pages)
            clicks.append([date, page, user])

random.shuffle(clicks)
df = df = pd.DataFrame(clicks, columns=['date', 'page', 'cookie_id'])
```

With the variables in this code, it will generate a randomised dataset with roughly ~2 million rows in around ~10 seconds. I make use of Python's `random.gammavariate()` function to return time difference values that are mostly around 20 minutes. This is just one method of using a probability function which generates numbers that are more naturally distributed rather than completely random and Gaussian.

## Use vectorised functions as much as possible
The simplest way to iterate over a large Pandas DataFrame is to use functions such as `.iterrows()` (which is extremely slow) or the faster method of `for row in df.index` or `df.apply()`. The former is very slow because it loads the entire row into memory with each iteration, whilst the latter allows you to selectively load the columns of interest from each row, thus dramatically speeding up performance. More details [here](https://engineering.upside.com/a-beginners-guide-to-optimizing-pandas-code-for-speed-c09ef2c6a4d6). The best way, if possible, is to use vectorised functions which operate on the whole DataFrame, as opposed to requiring a loop.

The strategy employed here involves 'shifting' the cookie ID column (or any unique identifier for the browser) and storing it as the next column. In this way, whilst iterating, you can make direct comparisons to the previous row using the same row. The same method is applied to calculate the time difference, using Pandas' `df.diff()` function which calculates the difference from the Nth row.

```python
# First sort the DataFrame by cookie ID and then date
df = df.sort_values(by=['cookie_id', 'date']).reset_index()
# ~ 3 s to complete

df['prev_cookie_id'] = df.shift(1)['cookie_id']
df['time_diff'] = df.date.diff(1)
# < 1 s to complete
```

We can then use another vectorised function approach to calculate the session boundaries. By subtracting the session timeout value from each time difference row, we will get 0 or positive values only if the time difference exceeds the session timeout value. These correspond to the end of the session.

```python
df['session_boundary'] = df.time_diff - datetime.timedelta(minutes=30)
# ~ 150 ms to complete
```

To convert the `datetime.timedelta` objects into boolean objects, which will be faster to perform comparisons on later:

```python
df['session_boundary'] = df.session_boundary.apply(lambda row: True if row >= datetime.timedelta(0) else False)
# ~ 30 s to complete
```

## Use the 'multiprocessing' module
The `multiprocessing` module allows us to speed up computations by splitting tasks into separate processess, which the OS / CPU can distribute to different cores to speed up the job. However, for this particular task, we need to be careful how we split the DataFrame, as we need to keep clicks from individual cookie IDs together. To do so, we first implement the following function to partition the set of unique cookie IDs from our DataFrame. 

This function will return N number of lists, each list containing a set of unique non-overlapping cookie IDs from our original DataFrame.

```python
def create_partitions(df, partitions: int) -> list:
    """
    Splits the list of unique cookie IDs from a provided
    DataFrame into the specified number of partitions.

    Args:
        df: Pandas DataFrame to extract cookie IDs from
        partitions (int): Number of partitions to split into

    Returns:
        list: List of lists, each list containing a unique
            set of cookie IDs partitioned from the main
            list.
    """
    uniq_ids = df['cookie_id'].unique()
    partitions = list(
        filter(lambda x: x.size > 0, np.array_split(uniq_ids, partitions))
    )
    return partitions
```

The `multiprocessing` module implements multiple ways to split a job into different processes, we will be using the `Process` class to do so. This requires us to pass a function to be run by each process. This function implemented below takes in a set of cookies returned by the partition function above, and filters the dataset to include only those cookie IDs. It then iterates over it to check if either a session boundary is found, or if the cookie ID has changed from the previous row. If either condition is met, we need to assign a new unique session ID to consolidate the clicks of the next session. The unique ID is generated using the `uuid` module's `uuid4()` function which returns a unique string such as `ffa93afa-10fa-4358-a6de-02afadfac444`.

```python
def assign_sessions(df, partition: list, queue):
    """
    Assigns sessions to partition of DataFrame, created using list of 
    unique cookie IDs provided in partition argument.

    Args:
        df (pd.DataFrame): DataFrame containing clickstream data
        partition (list): List of unique cookie IDs to subset DataFrame
        queue: multiprocessing.Queue object to add results to
    """
    _df = df.loc[df['cookie_id'].isin(partition), :]
    curr_session_uuid = str(uuid.uuid4())

    def _get_or_create_uuid(row) -> str:
        nonlocal curr_session_uuid
        curr_uniq_id = row['cookie_id']
        prev_anon_id = row['prev_cookie_id']
        boundary = row['session_boundary']

        if boundary is True or curr_uniq_id != prev_anon_id:
            curr_session_uuid = str(uuid.uuid4())
            return curr_session_uuid
        else:
            return curr_session_uuid

    _df.loc[:, 'session_uuid'] = _df.apply(
        lambda row: _get_or_create_uuid(row), axis=1
    )
    queue.put(_df)
```

You will also notice the use of the `queue` argument, which we call the `put()` function on. This is an object created to handle all the processes generated by the `multiprocessing` module, and importantly collate the outputs from the individual processes once they complete.

## Dispatching the jobs
Below is the structure for using the `Process` class from the `multiprocessing` module. We first set up a `Queue` object to hold all our processes we will make.

For each list of cookie IDs generated by our partition function, we create a new `Process` function to call the `assign_sessions` function. We pass as arguments to this function to the main DataFrame, the list of cookie IDs from the partition we are iterating over, and lastly the `Queue` object.

```python
from multiprocessing import Process, Queue
partitions = create_partitions(df, 12)
# Most CPUs support multi-threading, so the number of threads is double the number of cores
queue = Queue()
processes = []
for partition in partitions:
    processes.append(Process(
        target=assign_sessions,
        args=(df, partition, queue)
    ))
```

Each process is then started, and the results collected from each process using the `get()` function. We also need to call the `join()` function to merge the split out processes back into the main Python process.

```python
for process in processes:
    process.start()
results = [queue.get() for process in processes]
for process in processes:
    process.join()
```

Our results will now be the smaller partitioned DataFrames, which we can merge back into one DataFrame as below:

```python
rdf = pd.concat(results, axis=0)
final_df = rdf.sort_index()
```

## Performance
So far, most functions took at most 3 s to complete, apart from converting the `datetime.timedelta` objects to boolean values which took around 30 s. The final step is the most computationally intensive, which if carried out in a single process takes about **70 seconds** on average. However, using parallel processing and six cores (~ 4 GHz max frequency), this reduced to as little as **14 seconds**. Ofcourse, these numbers are heavily dependent on the number of cores and clockspeed of your CPU, but the concept still applies to any multi-core CPU. 

This method, thus, provides an easy way to achieve performance boosts from parallel processing on a desktop or laptop computer, without the need for a cluster. Any suggestions, improvements or corrections are welcome! Please leave a comment below!