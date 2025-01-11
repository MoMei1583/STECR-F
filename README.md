**STECR-F:** A lightweight spatio-temporal classification framework with Entropy-based Change Resistance Filter.

The STECR-F algorithm integrates the concept of Spatiotemporal Entropy (STE) and, by applying weighted spatiotemporal neighborhood information, suppresses uncertainty in the classification process. It effectively enhances the spatiotemporal consistency of the classification results, particularly in high-variance regions, and reduces classification instability caused by spatiotemporal fluctuations.

As a lightweight spatiotemporal classification framework, STECR-F can be applied to primary classification results from various algorithms, with the choice of classification algorithm adjustable according to the specific application scenario. For example, deep learning algorithms can be chosen when a sufficient amount of high-quality training data is available, while in cases of limited training data and uneven species distribution, more suitable traditional algorithms can be employed.

STECR-F can be applied to the classification results (.tif) obtained from any classification model.

The files in the catalog include M-F.ipynb, PITSCM_GEE.js, STE.ipynb, STECR-F.ipynb, STECR-F_Testing-large-scale_data_efficiency.ipynb, Efficiency of STECR-F.txt .

The M-F file contains the process of post-processing the classification results using the plurality filter implementation.
The PITSCM_GEE file generates inter-annual primary classification maps based on different years of remote sensing data using the Random Forest algorithm in a gee environment.
The STE file contains the process of calculating spatial entropy (SE) and spatio-temporal entropy (STE).
The STECR-F file contains the post-processing results obtained using STECR-F under different STE threshold scenarios.
The STECR-F_Testing-large-scale_data_efficiency file tests the efficiency at large-scale data. The file used is the land use data of Beijing-Tianjin-Hebei, China.

We applied STECR-F to the two sizes of datasets with STE thresholds set to 0.25, 0.5, 0.75, and 1.0, respectively.
Dataset 1: data/PITSCM  316 x 186
Dataset 2: data/LULC  19,252 x 24,496

1. The first dataset has a dimension of 316 x 186 and the execution times for different STE thresholds are as follows:

---calculate_STE elapsed time: 0.0165 s  (STE threshold: 0.25)
Weighted convolution (apply_weighted_convolution) elapsed time: 0.0101 s
---calculate_STE elapsed time: 0.0152 s  (STE threshold: 0.50)
Weighted convolution (apply_weighted_convolution) elapsed time: 0.0091 s
---calculate_STE elapsed time: 0.0169 s  (STE threshold: 0.75)
Weighted convolution (apply_weighted_convolution) elapsed time: 0.0094 s
---calculate_STE elapsed time: 0.0161 s  (STE threshold: 1.0)
Weighted convolution (apply_weighted_convolution) elapsed time: 0.0091 s

2. The second dataset has a dimension of 19,252 x 24,496 and the execution times for different STE thresholds are as follows:

---calculate_STE elapsed time: 221.1300 s  (STE threshold: 0.25)
Weighted convolution (apply_weighted_convolution) elapsed time: 184.2178 seconds
---calculate_STE elapsed time: 210.4478 s (STE threshold: 0.50)
Weighted convolution (apply_weighted_convolution) elapsed time: 108.9728 seconds
---calculate_STE elapsed time: 195.9130 s  (STE threshold: 0.75)
Weighted convolution (apply_weighted_convolution) elapsed time: 105.6086 seconds
---calculate_STE elapsed time: 205.9109 s   (STE threshold: 1.0)
Weighted convolution (apply_weighted_convolution) elapsed time: 122.5730 seconds
