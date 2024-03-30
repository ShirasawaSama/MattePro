#include <simpleocv.h>
//#include <onnxruntime_cxx_api.h>
#include "utilities/UxpAddon.h"
#include "utilities/UxpTask.h"
#include "utilities/UxpValue.h"

bool process_matte(std::string image, std::string trimap, int left, int top, int right, int bottom) {
    cv::Mat img = cv::imread(image, 1);
    cv::Mat tri_old = cv::imread(trimap, cv::IMREAD_UNCHANGED);
    if (img.empty() || tri_old.empty()) return false;

    // crop the image
    cv::Rect roi(std::max(left, 0), std::max(top, 0), std::min(right - left, img.cols - 1), std::min(bottom - top, img.rows - 1));
    img = img(roi);

    cv::Size size = img.size();
    int w = size.width, h = size.height;
    if (w > 1280 || h > 1280) {
        if (w > h) {
            h = (int) ((double)h / (double) w * 1280.0);
            w = 1280;
        } else {
            w = (int) ((double)w / (double) h * 1280.0);
            h = 1280;
        }
    }

    w = (int) round((double) w / 32) * 32;
    h = (int) round((double) h / 32) * 32;
    if (w != size.width || h != size.height) {
        cv::resize(img, img, cv::Size(w, h), 0, 0, cv::INTER_NEAREST);
    }
    if (tri_old.cols != w || tri_old.rows != h) {
        cv::resize(tri_old, tri_old, cv::Size(w, h), 0, 0, cv::INTER_NEAREST);
    }

    cv::Mat tri(tri_old.rows, tri_old.cols, CV_8UC1);

    for (int y = 0; y < tri_old.rows; ++y) {
        for (int x = 0; x < tri_old.cols; ++x) {
            uchar* pixel = tri_old.ptr(y);

            if (pixel[x * 4 + 3] < 255) {
                tri.ptr(y)[x] = 0;
            } else {
                auto B = pixel[x * 4 + 0];
                auto G = pixel[x * 4 + 1];
                auto R = pixel[x * 4 + 2];
                auto val = (uchar)(B * 0.114 + G * 0.587 + R * 0.299);
                tri.ptr(y)[x] = val < 40 ? 0 : val > 130 ? 128 : 255;
            }
        }
    }

    if (!cv::imwrite(image + ".out.jpg", img)) return false;

    return cv::imwrite(trimap + ".out.png", tri);
}

int main() {
//    Ort::Env env(ORT_LOGGING_LEVEL_WARNING, "MattePro");
    process_matte("/private/var/folders/tq/hbd70sn127n54mz0ymfn0j9r0000gn/T/Adobe/UXP/PluginsStorage/PHSP/25/Developer/shirasawa.mattepro/PluginData/export-32lzt1ww1wc.jpg", "/private/var/folders/tq/hbd70sn127n54mz0ymfn0j9r0000gn/T/Adobe/UXP/PluginsStorage/PHSP/25/Developer/shirasawa.mattepro/PluginData/export-e4hxq8967q6.png", 0, 0, 4000, 4000);
    return 0;
}

addon_value uxp_matte(addon_env env, addon_callback_info info) {
    try {
        addon_value argv;
        size_t argc = 1;
        Check(UxpAddonApis.uxp_addon_get_cb_info(env, info, &argc, &argv, nullptr, nullptr));
        Value stdValue(env, argv);

        auto& args = stdValue.GetMap();

        auto image_path = args["image"].GetString();
        auto trimap_path = args["trimap"].GetString();
        auto& list = args["rect"].GetMap();
        //process_matte(image_path, trimap_path, (int)list["0"].GetNumber(), (int)list["1"].GetNumber(), (int)list["2"].GetNumber(), (int)list["3"].GetNumber())
        Value ret(image_path);

        return ret.Convert(env);
    } catch (...) {
        return CreateErrorFromException(env);
    }
}

addon_value init(addon_env env, addon_value exports, const addon_apis& addonAPIs) {
    addon_status status;
    addon_value fn = nullptr;

    // process_matte
    {
        status = addonAPIs.uxp_addon_create_function(env, nullptr, 0, uxp_matte, nullptr, &fn);
        if (status != addon_ok) {
            addonAPIs.uxp_addon_throw_error(env, nullptr, "Unable to wrap native function");
        }

        status = addonAPIs.uxp_addon_set_named_property(env, exports, "matte", fn);
        if (status != addon_ok) {
            addonAPIs.uxp_addon_throw_error(env, nullptr, "Unable to populate exports");
        }
    }
    return exports;
}

UXP_ADDON_INIT(init)

void terminate(addon_env) {
    try {
    } catch (...) {
    }
}

/* Register addon termination routine
 * Invoked by UXP during uxpaddon un-load.
 */
UXP_ADDON_TERMINATE(terminate)
