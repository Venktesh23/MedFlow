// Central Axios client with auth and standardized response helpers.
import axios from "axios";
import type { AxiosResponse } from "axios";

export const api = axios.create({
  baseURL: (() => {
    const rawBaseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "http://localhost:5000";
    return rawBaseUrl.endsWith("/api") ? rawBaseUrl : `${rawBaseUrl}/api`;
  })(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("medflow_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export function responseData<T>(response: AxiosResponse<{ data: T }>): T {
  return response.data.data;
}

export function dataOrFallback<T>(value: T, fallback: T): T {
  return value ?? fallback;
}
