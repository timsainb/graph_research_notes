import networkx as nx
import pandas as pd
import feedparser
import numpy as np
from tqdm.autonotebook import tqdm


def post_info_from_xml(
    xml_files,
    categories_to_subset=[
        "Papers",
        "Dissertations",
        "Paper reviews",
        "Blogs",
        "Datasets",
    ],
):
    post_df = pd.DataFrame(columns=["title", "tags", "category", "link", "date"])

    for xml_file in xml_files:
        # parse file
        d = feedparser.parse(xml_file)
        # unique entry types
        print(np.unique([i.wp_post_type for i in d.entries]))

        # go through entries
        for entry in tqdm(d.entries):
            # only interested in posts
            if entry.wp_post_type == "post":
                if entry.wp_status == "publish":
                    title = entry.title
                    tags = [tag.term for tag in entry.tags if tag.scheme == "post_tag"]
                    category = [
                        tag.term for tag in entry.tags if tag.scheme == "category"
                    ][0]
                    link = entry.link
                    publish_date = entry.published_parsed
                    post_df.loc[len(post_df)] = [
                        title,
                        tags,
                        category,
                        link,
                        publish_date,
                    ]

    post_df["slug"] = [i.lower().replace(" ", "_") for i in post_df.title.values]
    # subset only papers
    post_df = post_df[post_df.category.isin(categories_to_subset)]

    # generate tag df
    all_tags = np.concatenate(post_df.tags.values)
    tag_df = pd.DataFrame(
        [[i, np.sum(all_tags == i)] for i in np.unique(all_tags)],
        columns=["tag", "frequency"],
    )

    return post_df, tag_df


def post_df_to_graph(post_df, tag_df):
    """ Create a graph from post tags
    """
    # Create graph
    G = nx.Graph()

    # add nodes to graph
    for idx, row in post_df.iterrows():
        G.add_node(row.slug, type=row.category)

    ## add edges to graph
    # get weight as # of similar tags between two posts
    for idx, row in tqdm(post_df.iterrows(), total=len(post_df)):
        for idx2, row2 in post_df.iterrows():
            if row.title != row2.title:
                overlap = [tag for tag in row.tags if tag in row2.tags]
                if len(overlap) > 0:
                    # weight tags by frequency
                    weights = [
                        1 / np.log(tag_df[tag_df.tag == tag].frequency.values[0])
                        for tag in overlap
                    ]
                    weight = np.sum(weights)
                    # add edge
                    if weight > 0:
                        G.add_edge(row.slug, row2.slug, weight=weight)

    # remove nodes that aren't connected to anything
    num_conns = pd.DataFrame(columns=["node", "conns"])
    # remove nodes that have no connections
    for node in list(G.nodes().keys()):
        if G.degree(node) == 0:
            G.remove_node(node)
        else:
            num_conns.loc[len(num_conns)] = [node, G.degree(node)]
    return G, num_conns
