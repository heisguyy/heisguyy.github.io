---
layout: post
title:  "Demystifying Loss Functions:Cross Entropy"
date:   2020-11-21 12:34:34 +0100
categories: blog
---

Popular and extensive machine learning libraries have provided the luxury of just building machine learning models without knowing what's going on under the hood, with `.fit()` a machine learning model is ready. But to improve the performance of models we have to dive deep into the dark and dreaded waters of **OPTIMIZATION**. 

![ezgif.com-gif-maker.gif](https://cdn.hashnode.com/res/hashnode/image/upload/v1606264781896/QyBSCie2t.gif)

Optimization in machine learning is a process by which a model measures its inefficiencies and tries to improve on them. At the heart of optimization are loss functions, which is sometimes called cost functions or objective functions. Loss functions are simply what provide the measurement of inefficiencies in a model. Understanding loss functions plays a big role in improving your modelling skill and we will be going through a very popular classification loss function called **CROSS ENTROPY**


#### MAXIMUM LIKELIHOOD

To understand cross-entropy, it is essential to understand the concept of maximum likelihood. Machine learning classification algorithms predict the probabilities/likelihood of each of the possibilities being true and basis its classification based on that probability. So if a classification algorithm is fed with a cat image and it is asked to predict whether it is a cat or dog, it calculates the probability of it being a cat or dog. Let's assume it predicts a probability of 0.4 for a cat and 0.6 for it being a dog and therefore predicts the image is the image of a dog because the probability of it being a dog is more - in this case, it misclassifies it. 

Maximum likelihood aims to increase the probability of the actual value, so in this case, maximum likelihood takes the probability of the cat and aims at improving the probability. Once the predicted probability of it being a cat surpasses 0.5, it is correctly classified but the maximum likelihood isn't done. Maximum likelihood follows the idea that the larger the predicted probability of the correct class, the better the algorithm. Maximum likelihood is looking forward to maximizing the correct class's probability/likelihood (you see what I did in the last sentence😉).

Now let's look at a more complicated case of more than two classes and more than two samples. Let's say we have 4 images, of rabbit, squirrel, rabbit and rat respectively, to classify as rabbit or squirrel or rat. Let's assume the machine 
* predicted that the probability of the first image is 0.75 for it being a rabbit, 0.14 for it being a squirrel and 0.11 for it being a rat,
* predicted probabilities for the second image was 0.44 for it being a rabbit, 0.42 for it being a squirrel and 0.14 for it being a rat,
* predicted probabilities for the third image was 0.39 for it being a rabbit, 0.58 for it being a squirrel and 0.03 for it being a rat,
* predicted probabilities of the last image to be 0.01 for it being a rabbit,  0.19 for it being a squirrel and 0.8 for it being a rat.

The maximum likelihood takes `0.75*0.42*0.39*0.8`, which results in 0.09828, as the probability to work on. That value was made up by multiplying the predicted probabilities of the correct option for the animals in each of those cases. The animal in the first image was a rabbit therefore we pick the predicted probability of the rabbit. The probabilities are picked across samples(images) using this method. 

Now the problem with maximum likelihood is that it deals with multiplication. Multiplication can scale up really fast, and also maximizing loss functions are kind of weird 😖. It would bring us to our aim in this article once again, **CROSS ENTROPY**

#### CROSS ENTROPY

We are now interested in a function that could change our multiplication and change the direction of our cause to minimise instead of maximizing. The secret ingredient is the negative of logarithms. According to the laws of logarithm, the logarithm of the multiplication of any numbers is equal to the addition of the logarithms of each of those numbers, `log (a*b) = log a + log b`. Also, as any number approaches 1 from 0, the logarithm approaches 0 from negative infinity. Taking the negative of the logarithm will mean as the number approaches 1 from zero, the logarithm approaches 0 from positive infinity. We have now achieved both goals but for standard/convention sake we will be using natural logarithms `ln` instead of the logarithm to base 10. It will still follow the same logic as stated earlier, so we don't have to bother about any other complications. 

Cross entropy is simply the negative natural logarithms of probabilities of an actual event happening and the lower the cross entropy the better the prediction. If we have three gift boxes with gifts in just two of them (first and last boxes) and there is a predicted probability of 0.6, 0.7, and 0.4 respectively that there are gifts in the boxes. The probabilities we will take into account here will be 0.6 for the first box, 0.3 for the second box (1-0.7, probability that there isn't a gift in the box because there isn't a gift in the second box) and 0.4 for the third. The cross-entropy for this will be `-ln 0.6 - ln 0.3 - ln 0.4`, this is a result of `-ln(0.6*0.3*0.4)`. 

Now let's look at a more complicated case of three samples and three possible events per sample. Assuming we have three bottles that can contain three different liquids, soda, orange juice and wine, but the bottles are filled with orange juice, orange juice and soda respectively. If the machine predicted probability for the:

* first bottle are 0.1 for soda, 0.4 for orange juice and 0.5 for wine,
* second bottle are 0.2 for soda, 0.6 for orange juice and 0.2 for wine,
* third are 0.7 for soda, 0.2 for orange juice and 0.1 for wine

Then the cross entropy is `-ln 0.4 - ln 0.6 - ln 0.7`, which is `1.7838`. Taken the probabilities of the events that happened in each of the samples(bottles). We can now take it a step further to create a generalized equation that works for all `k` possibilities in `N` samples,


![GKdbq.png](https://cdn.hashnode.com/res/hashnode/image/upload/v1607578611259/QDVLc-4nK.png)

Where, 
* `N` is the number of samples,
* `k` is the number of possibilities in each sample
* `ti,j` is the probability it possibility j happened in i. Its value is usually 0 or 1 and it acts are a switch 
* `Pi,j` is the predicted probability of j in sample i. 

Note: If you want to read about more loss functions and their implementations in PyTorch, you can check [this great article](https://neptune.ai/blog/pytorch-loss-functions)

